-- ═══════════════════════════════════════════════════════════════════════════
--  Base de datos del turnero GanaGana (Supabase / Postgres)
--  El servidor crea estas tablas SOLO al arrancar. Este archivo es para verlas o,
--  si prefieres, pegarlas en Supabase → SQL Editor → Run.
--  RLS activado y sin políticas: la API pública de Supabase no puede leer nada.
-- ═══════════════════════════════════════════════════════════════════════════

CREATE TABLE IF NOT EXISTS administradores (
id             SERIAL PRIMARY KEY,
usuario        VARCHAR(24)  NOT NULL,
nombre         VARCHAR(60)  NOT NULL,
clave_hash     VARCHAR(200) NOT NULL,
rol            VARCHAR(40)  NOT NULL DEFAULT 'Administrador',
saludo         VARCHAR(120) NOT NULL DEFAULT 'Tu acceso al panel está listo.',
avatar         VARCHAR(16)  NOT NULL DEFAULT '🧑‍💼',
principal      BOOLEAN      NOT NULL DEFAULT false,
email          VARCHAR(120) NOT NULL DEFAULT '',
github         VARCHAR(39)  NOT NULL DEFAULT '',
debe_cambiar   BOOLEAN      NOT NULL DEFAULT false,
creado_en      TIMESTAMPTZ  NOT NULL DEFAULT now(),
actualizado_en TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS uq_admin_usuario ON administradores (lower(usuario));

CREATE TABLE IF NOT EXISTS contador (
id             SMALLINT PRIMARY KEY CHECK (id = 1),
valor          INTEGER     NOT NULL DEFAULT 0,
actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS turnos (
id            BIGINT PRIMARY KEY,
turno         INTEGER     NOT NULL,
caja          INTEGER     NOT NULL,
llamado_en    TIMESTAMPTZ NOT NULL DEFAULT now(),
llamado_texto TEXT
);

CREATE INDEX IF NOT EXISTS idx_turnos_llamado ON turnos (llamado_en);

CREATE TABLE IF NOT EXISTS configuracion (
id             SMALLINT PRIMARY KEY CHECK (id = 1),
datos          JSONB       NOT NULL,
actualizado_en TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS actividad (
id         BIGSERIAL PRIMARY KEY,
cuando     TIMESTAMPTZ  NOT NULL DEFAULT now(),
admin_id   INTEGER,
usuario    VARCHAR(24),
nombre     VARCHAR(60),
accion     VARCHAR(60)  NOT NULL,
detalle    TEXT         NOT NULL DEFAULT '',
ip         VARCHAR(64)
);

CREATE INDEX IF NOT EXISTS idx_actividad_cuando ON actividad (cuando DESC);

ALTER TABLE administradores ENABLE ROW LEVEL SECURITY;

ALTER TABLE contador        ENABLE ROW LEVEL SECURITY;

ALTER TABLE turnos          ENABLE ROW LEVEL SECURITY;

ALTER TABLE configuracion   ENABLE ROW LEVEL SECURITY;

ALTER TABLE actividad       ENABLE ROW LEVEL SECURITY;

-- Ver lo guardado:
-- SELECT valor FROM contador;                         -- número actual (nunca se depura)
-- SELECT count(*) FROM turnos;                        -- historial (se depura a los 7 días)
-- SELECT usuario, nombre, rol FROM administradores;
