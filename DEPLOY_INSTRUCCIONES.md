# Deploy: Render + Supabase (PostgreSQL)

## Resumen del stack

| Componente  | Servicio          | Costo        |
|-------------|-------------------|--------------|
| Backend API | Render (free)     | Gratis       |
| Frontend    | Render (mismo)    | Incluido     |
| Base datos  | Supabase (free)   | Gratis 500MB |

---

## PASO 1 — Crear proyecto en Supabase

1. Vaya a [https://supabase.com](https://supabase.com) y cree una cuenta gratuita
2. Clic en **New project**
3. Complete:
   - **Name**: `alvarez-pos` (o el nombre que prefiera)
   - **Database Password**: elija una contraseña segura y **guárdela**
   - **Region**: la más cercana (ej. `South America (São Paulo)`)
4. Espere ~2 minutos mientras el proyecto se inicializa

---

## PASO 2 — Crear las tablas en Supabase

1. En el panel de Supabase, vaya a **SQL Editor** (ícono de terminal en la barra lateral)
2. Clic en **New query**
3. Copie y pegue todo el contenido de `database/schema_postgresql.sql`
4. Clic en **Run** (o Ctrl+Enter)
5. Verá el mensaje `Success. No rows returned` — las tablas fueron creadas

---

## PASO 3 — Obtener la connection string

1. En Supabase, vaya a **Project Settings** → **Database**
2. Busque la sección **Connection string** → pestaña **URI**
3. Copie el valor — se ve así:
   ```
   postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
   ```
4. Reemplace `[PASSWORD]` con la contraseña que eligió en el Paso 1

---

## PASO 4 — Configurar Render

1. Vaya a [https://render.com](https://render.com) y cree una cuenta gratuita
2. Conecte su repositorio de GitHub con el proyecto
3. Render detectará `render.yaml` y creará el servicio automáticamente
4. En el panel del servicio, vaya a **Environment** → **Add Environment Variable**:

| Variable       | Valor                                         |
|----------------|-----------------------------------------------|
| `DATABASE_URL` | Connection string de Supabase (Paso 3)        |
| `FRONTEND_URL` | `https://[su-nombre-app].onrender.com`        |
| `RENDER`       | `true`                                        |

5. Haga clic en **Save Changes** — Render reiniciará el servidor

---

## PASO 5 — Verificar el deploy

Una vez que Render termine de compilar (3–5 minutos):

```bash
# Verificar que la API responde
curl https://[su-nombre-app].onrender.com/health
```

Respuesta esperada:
```json
{
  "status": "ok",
  "db": "Conectado a PostgreSQL — db.[REF].supabase.co:5432/postgres",
  "version": "1.0.0"
}
```

Si `status` es `"degraded"`, verifique que `DATABASE_URL` esté correctamente configurada en Render.

---

## PASO 6 — Primer uso

> ⚠️ **El PIN por defecto es 1234. Cámbielo inmediatamente.**
>
> 1. Abra el sistema en el navegador
> 2. Vaya a **Admin** en el menú superior
> 3. Ingrese el PIN actual: **1234**
> 4. En la sección **Configuración**, cambie el campo "PIN administrador"
> 5. Haga clic en **Guardar**

---

## PASO 7 — Monitoreo con UptimeRobot (opcional pero recomendado)

Render en el plan gratuito duerme el servidor si no hay tráfico en 15 minutos.
UptimeRobot lo mantiene despierto enviando pings cada 5 minutos.

1. Cree cuenta en [https://uptimerobot.com](https://uptimerobot.com)
2. **Add New Monitor** → tipo **HTTP(s)**
3. URL: `https://[su-nombre-app].onrender.com/health`
4. Intervalo: **5 minutos**
5. Clic en **Create Monitor**

---

## Solución de problemas

**El deploy falla con "ModuleNotFoundError: psycopg2"**
→ Verifique que `requirements_api.txt` contiene `psycopg2-binary>=2.9.9`

**Error de conexión a la BD**
→ Verifique que `DATABASE_URL` en Render incluye la contraseña correcta y sin espacios

**Las tablas no se crean automáticamente**
→ El endpoint `/health` llama a `inicializar_bd()` al arrancar.
  Si falla, revise los logs en Render → **Logs**

**`status: degraded` en /health**
→ Copie el mensaje del campo `db` — incluye el detalle del error de PostgreSQL

---

## Variables de entorno de referencia

```bash
# Requeridas
DATABASE_URL=postgresql://postgres:[PASSWORD]@db.[REF].supabase.co:5432/postgres
FRONTEND_URL=https://[su-nombre-app].onrender.com
RENDER=true
```

El puerto (`PORT`) lo inyecta Render automáticamente — no es necesario configurarlo.
