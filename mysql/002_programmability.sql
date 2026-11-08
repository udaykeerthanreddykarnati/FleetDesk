USE fleet_logistics;

DROP TRIGGER IF EXISTS trg_shipments_status_before_update;
DROP TRIGGER IF EXISTS trg_shipments_history_after_insert;
DROP TRIGGER IF EXISTS trg_shipments_history_after_update;
DELIMITER $$
CREATE TRIGGER trg_shipments_status_before_update
BEFORE UPDATE ON shipments
FOR EACH ROW
BEGIN
  IF OLD.status = 'delivered' AND NEW.status <> 'delivered' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A delivered shipment cannot move back to an earlier status';
  END IF;
  IF NEW.status = 'delivered' AND OLD.status <> 'delivered' THEN
    SET NEW.delivered_at = COALESCE(NEW.delivered_at, CURRENT_TIMESTAMP);
  END IF;
END$$

CREATE TRIGGER trg_shipments_history_after_insert
AFTER INSERT ON shipments
FOR EACH ROW
BEGIN
  INSERT INTO shipment_status_history (shipment_id, old_status, new_status)
  VALUES (NEW.id, NULL, NEW.status);
END$$

CREATE TRIGGER trg_shipments_history_after_update
AFTER UPDATE ON shipments
FOR EACH ROW
BEGIN
  IF OLD.status <> NEW.status THEN
    INSERT INTO shipment_status_history (shipment_id, old_status, new_status)
    VALUES (NEW.id, OLD.status, NEW.status);
  END IF;
END$$

DROP FUNCTION IF EXISTS fn_vehicle_expense_total$$
CREATE FUNCTION fn_vehicle_expense_total(p_vehicle_id BIGINT UNSIGNED)
RETURNS DECIMAL(14,2)
DETERMINISTIC
READS SQL DATA
BEGIN
  DECLARE result_total DECIMAL(14,2);
  SELECT COALESCE(SUM(amount), 0) INTO result_total
  FROM expenses WHERE vehicle_id = p_vehicle_id;
  RETURN result_total;
END$$

DROP PROCEDURE IF EXISTS sp_assign_trip$$
CREATE PROCEDURE sp_assign_trip(
  IN p_trip_id BIGINT UNSIGNED,
  IN p_vehicle_id BIGINT UNSIGNED,
  IN p_driver_id BIGINT UNSIGNED
)
BEGIN
  DECLARE v_trip_status VARCHAR(24);
  DECLARE v_vehicle_status VARCHAR(24);
  DECLARE v_driver_status VARCHAR(24);
  DECLARE v_vehicle_capacity DECIMAL(10,2);
  DECLARE v_shipment_weight DECIMAL(12,2);
  DECLARE v_license_expiry DATE;
  DECLARE v_conflicts INT DEFAULT 0;

  DECLARE EXIT HANDLER FOR SQLEXCEPTION
  BEGIN
    ROLLBACK;
    RESIGNAL;
  END;

  START TRANSACTION;
  SELECT status INTO v_trip_status FROM trips WHERE id=p_trip_id FOR UPDATE;
  SELECT status, capacity_kg INTO v_vehicle_status, v_vehicle_capacity
  FROM vehicles WHERE id=p_vehicle_id FOR UPDATE;
  SELECT status, license_expires_on INTO v_driver_status, v_license_expiry
  FROM drivers WHERE id=p_driver_id FOR UPDATE;

  IF v_trip_status <> 'planned' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Only planned trips can be assigned';
  END IF;
  IF v_vehicle_status <> 'available' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Vehicle is not available';
  END IF;
  IF v_driver_status <> 'available' THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Driver is not available';
  END IF;
  IF v_license_expiry < CURRENT_DATE THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Driver license is expired';
  END IF;

  SELECT COALESCE(SUM(s.weight_kg), 0) INTO v_shipment_weight
  FROM trip_shipments ts JOIN shipments s ON s.id=ts.shipment_id
  WHERE ts.trip_id=p_trip_id;
  IF v_shipment_weight > v_vehicle_capacity THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Shipment load is over vehicle capacity';
  END IF;

  -- Lock the shipment rows in this trip before checking whether another trip
  -- acquired any of them; concurrent assignments then serialize on the rows.
  UPDATE shipments s
  JOIN trip_shipments ts ON ts.shipment_id=s.id
  SET s.updated_at=s.updated_at
  WHERE ts.trip_id=p_trip_id;
  SELECT COUNT(*) INTO v_conflicts
  FROM trip_shipments ts JOIN shipments s ON s.id=ts.shipment_id
  WHERE ts.trip_id=p_trip_id AND s.status NOT IN ('pending','delayed');
  IF v_conflicts > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Every shipment on this trip must be pending or delayed';
  END IF;

  SELECT COUNT(*) INTO v_conflicts
  FROM trip_shipments requested
  JOIN trip_shipments existing ON existing.shipment_id=requested.shipment_id AND existing.trip_id<>p_trip_id
  JOIN trips t ON t.id=existing.trip_id AND t.status IN ('assigned','in_progress')
  WHERE requested.trip_id=p_trip_id;
  IF v_conflicts > 0 THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'A shipment is already assigned to another active trip';
  END IF;

  UPDATE trips
  SET vehicle_id=p_vehicle_id, driver_id=p_driver_id, status='assigned'
  WHERE id=p_trip_id;
  UPDATE vehicles SET status='on_trip' WHERE id=p_vehicle_id;
  UPDATE drivers SET status='on_trip' WHERE id=p_driver_id;
  UPDATE shipments s
  JOIN trip_shipments ts ON ts.shipment_id=s.id
  SET s.status='assigned'
  WHERE ts.trip_id=p_trip_id AND s.status IN ('pending','delayed');
  COMMIT;
END$$
DELIMITER ;
