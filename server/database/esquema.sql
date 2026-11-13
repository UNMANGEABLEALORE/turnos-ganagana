-- ═══════════════════════════════════════════════════════════════════════════
--  Base de datos del turnero GanaGana (MySQL / MariaDB de XAMPP)
--  El servidor crea la tabla solo al arrancar; este archivo es para verla o
--  importarla a mano desde phpMyAdmin (http://localhost/phpmyadmin).
-- ═══════════════════════════════════════════════════════════════════════════

CREATE DATABASE IF NOT EXISTS turnos_ganagana
  CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

USE turnos_ganagana;

CREATE TABLE IF NOT EXISTS administradores (
  id             INT UNSIGNED  NOT NULL AUTO_INCREMENT PRIMARY KEY,
  usuario        VARCHAR(24)   NOT NULL,                       -- nombre de usuario para entrar
  nombre         VARCHAR(60)   NOT NULL,                       -- nombre real
  clave_hash     VARCHAR(200)  NOT NULL COMMENT 'Contraseña cifrada con scrypt (sal:hash). Nunca en texto plano.',
  rol            VARCHAR(40)   NOT NULL DEFAULT 'Administrador',
  saludo         VARCHAR(120)  NOT NULL DEFAULT 'Tu acceso al panel está listo.',
  avatar         VARCHAR(16)   NOT NULL DEFAULT '🧑‍💼',
  principal      TINYINT(1)    NOT NULL DEFAULT 0,             -- 1 = puede crear/eliminar administradores
  email          VARCHAR(120)  NOT NULL DEFAULT '',            -- para entrar con Google
  github         VARCHAR(39)   NOT NULL DEFAULT '',            -- para entrar con GitHub
  debe_cambiar   TINYINT(1)    NOT NULL DEFAULT 0,
  creado_en      DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP,
  actualizado_en DATETIME      NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY uq_usuario (usuario)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- Usuario de la aplicación (solo con permisos sobre esta base de datos).
-- Cambia 'CAMBIA_ESTA_CLAVE' y pon la misma en credenciales/.env (MYSQL_PASSWORD).
-- CREATE USER IF NOT EXISTS 'turnos_app'@'localhost' IDENTIFIED BY 'CAMBIA_ESTA_CLAVE';
-- GRANT SELECT, INSERT, UPDATE, DELETE, CREATE, ALTER, INDEX ON turnos_ganagana.* TO 'turnos_app'@'localhost';
-- FLUSH PRIVILEGES;

-- Ver los administradores guardados:
-- SELECT id, usuario, nombre, rol, principal, creado_en FROM administradores;
