# Alvarez Fast Food POS — Guía de producción

## ¿Qué es este sistema?

Un sistema de ventas (POS) para el restaurante. Funciona en la red local:
el computador del local actúa como servidor y las tablets/celulares se
conectan desde el navegador sin instalar nada.

---

## Instalación desde cero

**Requisitos previos:**

1. **Python 3.11 o superior**
   - Descargue desde https://www.python.org/downloads/
   - Durante la instalación, active **"Add Python to PATH"**

2. **XAMPP** (para la base de datos MySQL)
   - Descargue desde https://www.apachefriends.org/ (es gratuito)
   - Instale con las opciones por defecto

3. **Node.js 20** (para compilar el sitio web)
   - Descargue desde https://nodejs.org/
   - Elija la versión "LTS"

**Pasos de instalación:**

1. Abra XAMPP y haga clic en **Start** junto a **MySQL**
2. Haga doble clic en `Iniciar_PWA.bat`
3. La primera vez tardará unos minutos instalando dependencias
4. Al terminar, el navegador abrirá automáticamente el sistema

---

## Uso diario

**Para iniciar el sistema:**
→ Haga doble clic en `Iniciar_PWA.bat`

**Para abrir en tablets/celulares:**
→ La ventana de inicio muestra la dirección, por ejemplo:
  `http://192.168.1.100:8000`
→ Escriba esa dirección en el navegador de la tablet

**Para cerrar:**
→ Cierre la ventana negra del servidor
→ Cierre XAMPP

---

## Cómo hacer un backup manual

1. Abra el sistema Tkinter (`Iniciar_AlvarezPOS.bat`)
2. Menú **Caja** → **Exportar backup BD...**
3. Elija dónde guardar el archivo `.sql`

**O desde la carpeta `backups/`:**
Los backups automáticos se guardan ahí cada vez que abre la app.
Se mantienen los últimos 30 archivos.

---

## Cómo cambiar el PIN de administrador

1. Abra el sistema en el navegador
2. Vaya a **Admin** en el menú superior
3. Ingrese el PIN actual (por defecto: **1234**)
4. En la sección **Configuración**, cambie el campo "PIN administrador"
5. Haga clic en **Guardar**

> ⚠️ Anote el PIN nuevo en un lugar seguro. Si lo olvida, contacte
> al técnico que instaló el sistema.

---

## Cómo agregar un producto nuevo

1. Abra el sistema en el navegador
2. Vaya a **Admin** → ingrese el PIN
3. En la pestaña **Productos**, haga clic en **+ Nuevo producto**
4. Complete: Nombre, Precio (en pesos sin puntos ni comas), Categoría
5. Haga clic en **Guardar**

El producto aparece inmediatamente en la pantalla de ventas.

---

## Qué hacer si la app no abre

**El sistema muestra "MySQL no está corriendo":**
1. Abra el panel de control de XAMPP
2. Haga clic en **Start** junto a **MySQL**
3. Vuelva a ejecutar `Iniciar_PWA.bat`

**El navegador muestra "Esta página no está disponible":**
1. Verifique que la ventana negra del servidor esté abierta
2. Si está cerrada, ejecute `Iniciar_PWA.bat` de nuevo

**La tablet no puede conectarse:**
1. Asegúrese de que la tablet y el computador estén en la **misma red WiFi**
2. Verifique la dirección IP que muestra la ventana de inicio
3. Desactive temporalmente el firewall de Windows si es necesario

**Error al guardar una venta:**
- La venta NO se perdió — el carrito se mantiene
- Verifique que XAMPP-MySQL siga corriendo
- Intente cobrar de nuevo

---

## Estructura de archivos importantes

```
Proyecto_ALvarez-main/
├── Iniciar_AlvarezPOS.bat   ← Abre el sistema Tkinter (para 1 PC)
├── Iniciar_PWA.bat          ← Abre el servidor web (para tablets)
├── backups/                 ← Backups automáticos de la base de datos
├── data/                    ← Exportaciones Excel y JSON
└── logs/                    ← Registros del servidor API
```

---

## Limitaciones técnicas conocidas

**El servidor debe correr con un solo proceso (worker).**

El sistema guarda el estado de las mesas en la memoria del servidor.
Si se iniciara con múltiples procesos (workers), cada uno tendría su propia
memoria y los carritos de las mesas se mezclarían entre procesos.

El archivo `Iniciar_PWA.bat` ya lanza el servidor correctamente con un
solo proceso. **No modifique el comando de inicio agregando `--workers`.**

---

## Soporte

Para problemas técnicos, comuníquese con el desarrollador.
