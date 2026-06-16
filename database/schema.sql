-- Alvarez Fast Food -- Base de datos para XAMPP (phpMyAdmin)
-- 1. Inicie MySQL en el panel de XAMPP
-- 2. Abra http://localhost/phpmyadmin
-- 3. Pestana Importar -> elegir este archivo -> Continuar

CREATE DATABASE IF NOT EXISTS alvarez_fastfood
  CHARACTER SET utf8mb4
  COLLATE utf8mb4_unicode_ci;

USE alvarez_fastfood;

CREATE TABLE IF NOT EXISTS contador_facturas (
  anio INT NOT NULL PRIMARY KEY,
  ultimo_numero INT NOT NULL DEFAULT 0
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS ventas (
  id_factura       VARCHAR(24)  NOT NULL PRIMARY KEY,
  fecha_hora       VARCHAR(32)  NOT NULL,
  metodo_pago      VARCHAR(30)  NOT NULL,
  tipo_entrega     VARCHAR(20)  NOT NULL,
  telefono_cliente VARCHAR(20)  DEFAULT NULL,
  total_pagar      INT          NOT NULL,
  turno_id         INT          DEFAULT NULL,
  monto_recibido   INT          NOT NULL DEFAULT 0,
  vuelto_dado      INT          NOT NULL DEFAULT 0,
  anulada          TINYINT(1)   NOT NULL DEFAULT 0,
  motivo_anulacion VARCHAR(200) DEFAULT NULL,
  INDEX idx_ventas_fecha (fecha_hora),
  INDEX idx_ventas_pago  (metodo_pago),
  INDEX idx_ventas_turno (turno_id)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS lineas_venta (
  id               INT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  id_factura       VARCHAR(24)  NOT NULL,
  producto_id      VARCHAR(64)  NOT NULL,
  producto_nombre  VARCHAR(255) NOT NULL,
  cantidad         INT          NOT NULL,
  precio_unitario  INT          NOT NULL,
  notas_modificacion TEXT,
  es_bebida_incluida TINYINT(1) NOT NULL DEFAULT 0,
  es_personalizado   TINYINT(1) NOT NULL DEFAULT 0,
  categoria          VARCHAR(64) DEFAULT '',
  INDEX idx_lineas_factura (id_factura),
  CONSTRAINT fk_lineas_venta_factura
    FOREIGN KEY (id_factura) REFERENCES ventas(id_factura)
    ON DELETE CASCADE
) ENGINE=InnoDB;

INSERT IGNORE INTO contador_facturas (anio, ultimo_numero) VALUES (YEAR(CURDATE()), 0);

CREATE TABLE IF NOT EXISTS productos (
  id           INT AUTO_INCREMENT PRIMARY KEY,
  producto_id  VARCHAR(30)  NOT NULL,
  nombre       VARCHAR(100) NOT NULL,
  precio       INT          NOT NULL,
  categoria    VARCHAR(50)  NOT NULL,
  ingredientes TEXT         DEFAULT NULL,
  activo       TINYINT(1)   NOT NULL DEFAULT 1,
  orden        INT          NOT NULL DEFAULT 0,
  cat_orden    INT          NOT NULL DEFAULT 0,
  created_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at   DATETIME     NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uk_producto_id (producto_id),
  INDEX idx_cat_activo (categoria, activo)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS configuracion (
  clave       VARCHAR(50)  NOT NULL PRIMARY KEY,
  valor       VARCHAR(255) NOT NULL,
  descripcion VARCHAR(200) DEFAULT NULL
) ENGINE=InnoDB;

INSERT IGNORE INTO configuracion (clave, valor, descripcion) VALUES
  ('nequi_numero',       '3143435217',                  'Numero de cuenta Nequi para cobros'),
  ('nombre_restaurante', 'Alvarez Fast Food',            'Nombre del restaurante'),
  ('prefijo_factura',    'FAC',                          'Prefijo base de facturas'),
  ('pin_admin',          '1234',                         'PIN de 4 digitos para reportes y configuracion'),
  ('domicilio_mensaje',  'Domicilio sin costo adicional','Mensaje en el ticket del cliente'),
  ('num_mesas',          '8',                            'Cantidad de mesas del restaurante'),
  ('metodos_pago',       'Efectivo,Nequi,Transferencia,Otros', 'Metodos de pago habilitados');

CREATE TABLE IF NOT EXISTS turnos (
  id                INT AUTO_INCREMENT PRIMARY KEY,
  cajero            VARCHAR(100) NOT NULL DEFAULT 'Cajero',
  fecha_apertura    DATETIME     NOT NULL,
  efectivo_inicial  INT          NOT NULL DEFAULT 0,
  fecha_cierre      DATETIME     DEFAULT NULL,
  total_ventas      INT          NOT NULL DEFAULT 0,
  total_vueltos     INT          NOT NULL DEFAULT 0,
  efectivo_esperado INT          NOT NULL DEFAULT 0,
  anulado           TINYINT(1)   NOT NULL DEFAULT 0,
  estado            ENUM('abierto','cerrado') NOT NULL DEFAULT 'abierto',
  INDEX idx_turnos_estado (estado),
  INDEX idx_turnos_fecha  (fecha_apertura)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS trabajadores (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nombre VARCHAR(100) NOT NULL,
  rol VARCHAR(50) DEFAULT 'Trabajador',
  tarifa_dia INT NOT NULL DEFAULT 0,
  recargo_festivo DECIMAL(3,1) DEFAULT 1.0,
  activo TINYINT DEFAULT 1,
  orden INT DEFAULT 0,
  created_at DATETIME DEFAULT NOW()
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS nomina_semana (
  id INT AUTO_INCREMENT PRIMARY KEY,
  fecha_inicio DATE NOT NULL,
  fecha_fin DATE NOT NULL,
  total INT NOT NULL DEFAULT 0,
  estado ENUM('borrador','pagada') DEFAULT 'borrador',
  fecha_pago DATETIME,
  notas VARCHAR(200)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS nomina_detalle (
  id INT AUTO_INCREMENT PRIMARY KEY,
  nomina_id INT NOT NULL,
  trabajador_id INT NOT NULL,
  nombre_trabajador VARCHAR(100) NOT NULL,
  rol VARCHAR(50),
  tarifa_dia INT NOT NULL,
  recargo_festivo DECIMAL(3,1) DEFAULT 1.0,
  trabajo_sabado TINYINT DEFAULT 0,
  trabajo_domingo TINYINT DEFAULT 0,
  trabajo_lunes TINYINT DEFAULT 0,
  dias_normales INT DEFAULT 0,
  dias_festivos INT DEFAULT 0,
  total_trabajador INT NOT NULL DEFAULT 0,
  FOREIGN KEY (nomina_id) REFERENCES nomina_semana(id),
  FOREIGN KEY (trabajador_id) REFERENCES trabajadores(id)
) ENGINE=InnoDB;
