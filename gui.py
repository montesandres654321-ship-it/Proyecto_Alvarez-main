"""
Interfaz gráfica Tkinter — Alvarez Fast Food (modo principal).
Ejecutar: python3 main.py   o   python3 gui.py
"""

from __future__ import annotations

import tkinter as tk
from datetime import datetime, timezone
from tkinter import messagebox, scrolledtext, simpledialog, ttk

from backup import backup_automatico_async, hacer_backup
from config import METODOS_PAGO, NEQUI_NUMERO, TIPOS_ENTREGA
from exportar_excel import exportar_ventas_excel
from logica import Carrito, etiqueta_pago, es_nequi, formatear_pesos, parsear_precio
from modelos import Producto
from persistencia import (
  ErrorBaseDatos,
  actualizar_producto,
  categorias_activas,
  crear_producto,
  exportar_ventas_json,
  get_config,
  guardar_factura,
  inicializar_bd,
  listar_productos,
  listar_ventas,
  obtener_venta_por_id,
  probar_conexion,
  reporte_cuadre_caja,
  set_config,
  siguiente_id_factura,
  toggle_activo_producto,
)
from tickets import guardar_tickets, ticket_cliente, ticket_cocina


# Colores Tema Oscuro Premium / Neón Moderno
COLOR_FONDO = "#0B0F19"
COLOR_PANEL = "#161B2E"
COLOR_ACENTO = "#FF3B5C"        # Neon Rose
COLOR_ACENTO_SEC = "#00F2FE"    # Electric Cyan
COLOR_OK = "#05C46B"            # Emerald Green
COLOR_TEXTO = "#F8FAFC"         # Pure soft white
COLOR_MUTED = "#94A3B8"         # Muted Slate Gray
COLOR_BOTON = "#1E293B"         # Deep Slate
COLOR_BOTON_HOVER = "#334155"   # Hover Slate


class AppVentas(tk.Tk):
  def __init__(self) -> None:
    super().__init__()
    self.title("Alvarez Fast Food — Punto de Venta | Copa Mundial 2026")
    self.geometry("1100x700")
    self.minsize(960, 600)
    self.configure(bg=COLOR_FONDO)

    self._estado_bd = ttk.Label(self, text="", font=("Segoe UI", 9))
    self._estado_bd.pack(side=tk.BOTTOM, fill=tk.X, padx=12, pady=4)

    try:
      inicializar_bd()
      ok, msg = probar_conexion()
      if ok:
        self._estado_bd.config(text=f"🗄 {msg}", foreground="#7cb342")
      else:
        self._estado_bd.config(text=f"⚠ {msg}", foreground="#ffb74d")
    except ErrorBaseDatos as e:
      messagebox.showerror(
        "MySQL — XAMPP",
        f"{e}\n\nInicie MySQL en XAMPP y ejecute:\n  python3 instalar_bd.py",
      )
      self._estado_bd.config(text="Sin conexión a MySQL", foreground=COLOR_ACENTO)

    # Backup automático al iniciar — corre en segundo plano sin bloquear la GUI
    backup_automatico_async(
      callback_error=lambda msg: self.after(
        0,
        lambda m=msg: self._estado_bd.config(
          text=f"Backup automatico fallido: {m[:90]}",
          foreground="#ffb74d",
        ),
      )
    )

    self.pedidos = {"Mesa 1": Carrito()}
    self.mesa_actual = "Mesa 1"
    _cats = categorias_activas()
    self._categoria_actual = _cats[0] if _cats else ""
    self._cantidad_var = tk.IntVar(value=1)

    self._configurar_estilos()
    self._construir_menu_superior()
    self._construir_cuerpo()
    self._mostrar_productos_categoria(self._categoria_actual)

  @property
  def carrito(self) -> Carrito:
    return self.pedidos[self.mesa_actual]

  def _cambiar_mesa(self, event=None) -> None:
    seleccion = self.var_mesa.get()
    if seleccion in self.pedidos:
      self.mesa_actual = seleccion
      self._actualizar_carrito()

  def _nueva_mesa(self) -> None:
    nombre = simpledialog.askstring("Nueva Mesa", "Nombre de la mesa o pedido (ej. Mesa 2):", parent=self)
    if nombre:
      nombre = nombre.strip()
      if not nombre: return
      if nombre in self.pedidos:
        messagebox.showinfo("Mesa existente", "Ya existe un pedido con ese nombre.", parent=self)
        return
      self.pedidos[nombre] = Carrito()
      self.combo_mesas["values"] = list(self.pedidos.keys())
      self.var_mesa.set(nombre)
      self._cambiar_mesa()

  def _cerrar_mesa_actual(self) -> None:
    if len(self.pedidos) == 1:
      self.carrito.limpiar()
      self._actualizar_carrito()
      return
    
    if not self.carrito.esta_vacio():
      if not messagebox.askyesno("Cerrar Mesa", f"La cuenta '{self.mesa_actual}' tiene productos. ¿Seguro que quieres cerrarla sin cobrar?", parent=self):
        return
    
    del self.pedidos[self.mesa_actual]
    self.mesa_actual = list(self.pedidos.keys())[0]
    self.combo_mesas["values"] = list(self.pedidos.keys())
    self.var_mesa.set(self.mesa_actual)
    self._actualizar_carrito()

  def _configurar_estilos(self) -> None:
    style = ttk.Style(self)
    try:
      style.theme_use("clam")
    except tk.TclError:
      pass
    style.configure("TFrame", background=COLOR_FONDO)
    style.configure("Panel.TFrame", background=COLOR_PANEL)
    style.configure("TLabel", background=COLOR_FONDO, foreground=COLOR_TEXTO, font=("Segoe UI", 10))
    style.configure("Titulo.TLabel", background=COLOR_FONDO, foreground=COLOR_ACENTO, font=("Segoe UI", 18, "bold"))
    style.configure("Total.TLabel", background=COLOR_PANEL, foreground=COLOR_ACENTO_SEC, font=("Segoe UI", 20, "bold"))
    style.configure("TLabelFrame", background=COLOR_PANEL, foreground=COLOR_TEXTO)
    style.configure("TLabelFrame.Label", background=COLOR_PANEL, foreground=COLOR_ACENTO, font=("Segoe UI", 11, "bold"))
    style.configure("Cat.TButton", font=("Segoe UI", 9), padding=6)
    style.configure("Prod.TButton", font=("Segoe UI", 9), padding=8)
    style.configure("Accion.TButton", font=("Segoe UI", 10, "bold"), padding=10)
    
    # Treeview moderno
    style.configure(
      "Treeview",
      background=COLOR_PANEL,
      foreground=COLOR_TEXTO,
      fieldbackground=COLOR_PANEL,
      font=("Segoe UI", 10),
      rowheight=30,
      borderwidth=0,
    )
    style.map("Treeview", background=[("selected", COLOR_ACENTO)], foreground=[("selected", "#FFFFFF")])
    style.configure(
      "Treeview.Heading",
      background=COLOR_BOTON,
      foreground=COLOR_TEXTO,
      relief="flat",
      font=("Segoe UI", 10, "bold"),
    )
    style.map("Treeview.Heading", background=[("active", COLOR_BOTON_HOVER)])

  def _construir_menu_superior(self) -> None:
    barra = tk.Menu(self, bg=COLOR_PANEL, fg=COLOR_TEXTO, activebackground=COLOR_ACENTO)
    self.config(menu=barra)

    menu_caja = tk.Menu(barra, tearoff=0, bg=COLOR_PANEL, fg=COLOR_TEXTO)
    barra.add_cascade(label="Caja", menu=menu_caja)
    menu_caja.add_command(label="Cuadre del día", command=self._ver_cuadre)
    menu_caja.add_command(label="Últimas ventas", command=self._ver_ventas)
    menu_caja.add_separator()
    menu_caja.add_command(label="Exportar JSON (Power BI)", command=self._exportar_json)
    menu_caja.add_command(label="Exportar Excel (total vendido)", command=self._exportar_excel)
    menu_caja.add_separator()
    menu_caja.add_command(label="Exportar backup BD...", command=self._exportar_backup)

    menu_admin = tk.Menu(barra, tearoff=0, bg=COLOR_PANEL, fg=COLOR_TEXTO)
    barra.add_cascade(label="Admin", menu=menu_admin)
    menu_admin.add_command(label="Productos", command=self._ventana_admin_productos)
    menu_admin.add_separator()
    menu_admin.add_command(label="Configuracion", command=self._ventana_configuracion)

    menu_ayuda = tk.Menu(barra, tearoff=0, bg=COLOR_PANEL, fg=COLOR_TEXTO)
    barra.add_cascade(label="Ayuda", menu=menu_ayuda)
    menu_ayuda.add_command(
      label="Estado base de datos",
      command=self._estado_base_datos,
    )
    menu_ayuda.add_command(
      label="Acerca de",
      command=lambda: messagebox.showinfo(
        get_config("nombre_restaurante", "Alvarez Fast Food"),
        f"Sistema de ventas — Copa Mundial 2026\n\n"
        f"Nequi: {get_config('nequi_numero', NEQUI_NUMERO)}\n"
        f"{get_config('domicilio_mensaje', 'Domicilio sin costo adicional')}\n\n"
        "Gaseosas: Personal $2.000 | Familiar $5.000 (categoría GASEOSAS)\n"
        "Cada sección tiene pedido personalizado con precio libre.",
      ),
    )

    header = ttk.Frame(self, style="TFrame")
    header.pack(fill=tk.X, padx=12, pady=(10, 4))
    ttk.Label(header, text="⚽ ALVAREZ FAST FOOD", style="Titulo.TLabel").pack(side=tk.LEFT)
    ttk.Label(
      header,
      text="Punto de venta — Edición Copa Mundial 2026",
      font=("Segoe UI", 10),
      background=COLOR_FONDO,
      foreground="#aaa",
    ).pack(side=tk.LEFT, padx=12)

  def _estado_base_datos(self) -> None:
    ok, msg = probar_conexion()
    if ok:
      messagebox.showinfo("Base de datos MySQL", msg, parent=self)
    else:
      messagebox.showerror(
        "Base de datos MySQL",
        f"{msg}\n\n1. XAMPP → Start MySQL\n2. python3 instalar_bd.py\n"
        "3. O importe database/schema.sql en phpMyAdmin",
        parent=self,
      )

  def _construir_cuerpo(self) -> None:
    contenedor = ttk.PanedWindow(self, orient=tk.HORIZONTAL)
    contenedor.pack(fill=tk.BOTH, expand=True, padx=10, pady=8)

    # --- Panel izquierdo: categorías + productos ---
    izq = ttk.Frame(contenedor, style="Panel.TFrame", padding=8)
    contenedor.add(izq, weight=3)

    ttk.Label(izq, text="Categorías", font=("Segoe UI", 11, "bold"), background=COLOR_PANEL, foreground=COLOR_ACENTO).pack(anchor=tk.W)

    self.frame_cats = ttk.Frame(izq, style="Panel.TFrame")
    self.frame_cats.pack(fill=tk.X, pady=(4, 10))

    self._botones_categoria: dict[str, tk.Button] = {}
    for cat in categorias_activas():
      btn = tk.Button(
        self.frame_cats,
        text=cat.title(),
        font=("Segoe UI", 9, "bold"),
        bg=COLOR_BOTON,
        fg=COLOR_TEXTO,
        activebackground=COLOR_ACENTO,
        activeforeground="white",
        relief=tk.FLAT,
        padx=10,
        pady=6,
        cursor="hand2",
        command=lambda c=cat: self._mostrar_productos_categoria(c),
      )
      btn.pack(side=tk.LEFT, padx=4, pady=2)
      btn.bind("<Enter>", lambda e, b=btn, c=cat: b.configure(bg=COLOR_ACENTO if self._categoria_actual == c else COLOR_BOTON_HOVER))
      btn.bind("<Leave>", lambda e, b=btn, c=cat: b.configure(bg=COLOR_ACENTO if self._categoria_actual == c else COLOR_BOTON))
      self._botones_categoria[cat] = btn

    frame_cant = ttk.Frame(izq, style="Panel.TFrame")
    frame_cant.pack(fill=tk.X, pady=4)
    ttk.Label(frame_cant, text="Cantidad:", background=COLOR_PANEL, foreground=COLOR_TEXTO).pack(side=tk.LEFT)
    spin = ttk.Spinbox(frame_cant, from_=1, to=20, width=5, textvariable=self._cantidad_var)
    spin.pack(side=tk.LEFT, padx=8)

    ttk.Label(izq, text="Productos (clic para agregar)", font=("Segoe UI", 10, "bold"), background=COLOR_PANEL, foreground=COLOR_TEXTO).pack(anchor=tk.W, pady=(8, 4))

    canvas_frame = ttk.Frame(izq, style="Panel.TFrame")
    canvas_frame.pack(fill=tk.BOTH, expand=True)

    self.canvas = tk.Canvas(canvas_frame, bg=COLOR_PANEL, highlightthickness=0)
    scroll_y = ttk.Scrollbar(canvas_frame, orient=tk.VERTICAL, command=self.canvas.yview)
    self.frame_productos = ttk.Frame(self.canvas, style="Panel.TFrame")

    self.frame_productos.bind(
      "<Configure>",
      lambda e: self.canvas.configure(scrollregion=self.canvas.bbox("all")),
    )
    self.canvas_window = self.canvas.create_window((0, 0), window=self.frame_productos, anchor=tk.NW)
    self.canvas.configure(yscrollcommand=scroll_y.set)
    self.canvas.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
    scroll_y.pack(side=tk.RIGHT, fill=tk.Y)

    self.canvas.bind("<Configure>", self._on_canvas_resize)
    self.canvas.bind_all("<MouseWheel>", self._on_mousewheel)

    # --- Panel derecho: carrito ---
    der = ttk.LabelFrame(contenedor, text="  Carrito  ", padding=10)
    contenedor.add(der, weight=2)

    frame_mesas = ttk.Frame(der, style="Panel.TFrame")
    frame_mesas.pack(fill=tk.X, pady=(0, 10))
    ttk.Label(frame_mesas, text="Mesa/Pedido:", background=COLOR_PANEL, foreground=COLOR_TEXTO).pack(side=tk.LEFT, padx=(0, 4))
    
    self.var_mesa = tk.StringVar(value=self.mesa_actual)
    self.combo_mesas = ttk.Combobox(frame_mesas, textvariable=self.var_mesa, state="readonly", width=14, font=("Segoe UI", 10))
    self.combo_mesas["values"] = list(self.pedidos.keys())
    self.combo_mesas.pack(side=tk.LEFT)
    self.combo_mesas.bind("<<ComboboxSelected>>", self._cambiar_mesa)

    tk.Button(
      frame_mesas, text="+ Nueva", bg=COLOR_BOTON, fg="white", font=("Segoe UI", 9),
      relief=tk.FLAT, padx=6, pady=2, cursor="hand2", command=self._nueva_mesa,
    ).pack(side=tk.LEFT, padx=6)
    
    tk.Button(
      frame_mesas, text="✖ Cerrar", bg="#e94560", fg="white", font=("Segoe UI", 9),
      relief=tk.FLAT, padx=6, pady=2, cursor="hand2", command=self._cerrar_mesa_actual,
    ).pack(side=tk.LEFT, padx=2)

    cols = ("cant", "producto", "subtotal")
    self.tree = ttk.Treeview(der, columns=cols, show="headings", height=14)
    self.tree.heading("cant", text="Cant.")
    self.tree.heading("producto", text="Producto")
    self.tree.heading("subtotal", text="Subtotal")
    self.tree.column("cant", width=50, anchor=tk.CENTER)
    self.tree.column("producto", width=280)
    self.tree.column("subtotal", width=100, anchor=tk.E)
    scroll_tree = ttk.Scrollbar(der, orient=tk.VERTICAL, command=self.tree.yview)
    self.tree.configure(yscrollcommand=scroll_tree.set)

    self.lbl_total = ttk.Label(der, text="TOTAL: $0", style="Total.TLabel")
    btns = ttk.Frame(der, style="Panel.TFrame")

    # Empaquetar de abajo hacia arriba para evitar que se aplasten cuando la ventana es pequeña
    btns.pack(side=tk.BOTTOM, fill=tk.X, pady=(10, 0))
    self.lbl_total.pack(side=tk.BOTTOM, pady=(10, 5))
    self.tree.pack(side=tk.TOP, fill=tk.BOTH, expand=True)

    btn_quitar = tk.Button(
      btns,
      text="Quitar última",
      bg=COLOR_BOTON,
      fg=COLOR_TEXTO,
      activebackground=COLOR_BOTON_HOVER,
      activeforeground="white",
      font=("Segoe UI", 9, "bold"),
      relief=tk.FLAT,
      padx=10,
      pady=8,
      cursor="hand2",
      command=self._quitar,
    )
    btn_quitar.pack(side=tk.LEFT, padx=4)
    btn_quitar.bind("<Enter>", lambda e, b=btn_quitar: b.configure(bg=COLOR_BOTON_HOVER))
    btn_quitar.bind("<Leave>", lambda e, b=btn_quitar: b.configure(bg=COLOR_BOTON))

    btn_vaciar = tk.Button(
      btns,
      text="Vaciar carrito",
      bg=COLOR_BOTON,
      fg=COLOR_TEXTO,
      activebackground=COLOR_BOTON_HOVER,
      activeforeground="white",
      font=("Segoe UI", 9, "bold"),
      relief=tk.FLAT,
      padx=10,
      pady=8,
      cursor="hand2",
      command=self._vaciar,
    )
    btn_vaciar.pack(side=tk.LEFT, padx=4)
    btn_vaciar.bind("<Enter>", lambda e, b=btn_vaciar: b.configure(bg=COLOR_BOTON_HOVER))
    btn_vaciar.bind("<Leave>", lambda e, b=btn_vaciar: b.configure(bg=COLOR_BOTON))

    btn_cobrar = tk.Button(
      btns,
      text="COBRAR",
      bg=COLOR_OK,
      fg="white",
      activebackground="#05DB75",
      activeforeground="white",
      font=("Segoe UI", 12, "bold"),
      relief=tk.FLAT,
      padx=24,
      pady=10,
      cursor="hand2",
      command=self._cobrar,
    )
    btn_cobrar.pack(side=tk.RIGHT, padx=4)
    btn_cobrar.bind("<Enter>", lambda e, b=btn_cobrar: b.configure(bg="#05DB75"))
    btn_cobrar.bind("<Leave>", lambda e, b=btn_cobrar: b.configure(bg=COLOR_OK))

    self._actualizar_carrito()

  def _on_canvas_resize(self, event: tk.Event) -> None:
    self.canvas.itemconfig(self.canvas_window, width=event.width)

  def _on_mousewheel(self, event: tk.Event) -> None:
    if event.widget.winfo_toplevel() == self:
      self.canvas.yview_scroll(int(-1 * (event.delta / 120)), "units")

  def _resaltar_categoria(self, cat: str) -> None:
    for nombre, btn in self._botones_categoria.items():
      if nombre == cat:
        btn.configure(bg=COLOR_ACENTO, fg="white")
      else:
        btn.configure(bg=COLOR_BOTON, fg=COLOR_TEXTO)

  def _mostrar_productos_categoria(self, categoria: str) -> None:
    self._categoria_actual = categoria
    self._resaltar_categoria(categoria)

    for w in self.frame_productos.winfo_children():
      w.destroy()

    cols = 2

    btn_custom = tk.Button(
      self.frame_productos,
      text="+ PEDIDO PERSONALIZADO\n(No está en el menú — usted pone nombre y precio)",
      font=("Segoe UI", 10, "bold"),
      bg=COLOR_ACENTO,
      fg="white",
      activebackground="#FF5E7E",
      activeforeground="white",
      relief=tk.FLAT,
      height=3,
      wraplength=480,
      justify=tk.CENTER,
      cursor="hand2",
      command=lambda c=categoria: self._pedido_personalizado(c),
    )
    btn_custom.grid(row=0, column=0, columnspan=cols, sticky="ew", padx=6, pady=(0, 10))
    btn_custom.bind("<Enter>", lambda e, b=btn_custom: b.configure(bg="#FF5E7E"))
    btn_custom.bind("<Leave>", lambda e, b=btn_custom: b.configure(bg=COLOR_ACENTO))

    productos = listar_productos(categoria=categoria)
    for i, producto in enumerate(productos):
      row, col = divmod(i, cols)
      row += 1
      texto = f"{producto.nombre}\n{formatear_pesos(producto.precio)}"

      btn = tk.Button(
        self.frame_productos,
        text=texto,
        font=("Segoe UI", 10, "bold"),
        bg=COLOR_BOTON,
        fg=COLOR_TEXTO,
        activebackground=COLOR_BOTON_HOVER,
        activeforeground="white",
        relief=tk.FLAT,
        width=28,
        height=4,
        wraplength=220,
        justify=tk.CENTER,
        cursor="hand2",
        command=lambda p=producto: self._agregar_producto(p),
      )
      btn.grid(row=row, column=col, padx=6, pady=6, sticky="nsew")
      btn.bind("<Enter>", lambda e, b=btn: b.configure(bg=COLOR_BOTON_HOVER))
      btn.bind("<Leave>", lambda e, b=btn: b.configure(bg=COLOR_BOTON))

    for c in range(cols):
      self.frame_productos.columnconfigure(c, weight=1)

  def _agregar_producto(self, producto: Producto) -> None:
    try:
      cantidad = int(self._cantidad_var.get())
      if cantidad < 1:
        cantidad = 1
    except tk.TclError:
      cantidad = 1

    notas = self._dialogo_notas(producto.nombre)
    if notas is False:
      return

    try:
      self.carrito.agregar_producto(producto, cantidad, notas or "")
      self._actualizar_carrito()
      self.bell()
    except ValueError as e:
      messagebox.showerror("Error", str(e), parent=self)

  def _pedido_personalizado(self, categoria: str) -> None:
    d = tk.Toplevel(self)
    d.title(f"Pedido personalizado — {categoria}")
    d.configure(bg=COLOR_PANEL)
    d.transient(self)
    d.grab_set()
    d.resizable(False, False)

    ttk.Label(
      d,
      text=f"Pedido fuera del menú en: {categoria}\n"
           "Ej: Salchipapa especial, combo grande, etc.",
      background=COLOR_PANEL,
      foreground=COLOR_TEXTO,
      font=("Segoe UI", 10),
      justify=tk.CENTER,
    ).grid(row=0, column=0, columnspan=2, padx=20, pady=(16, 10))

    ttk.Label(d, text="Nombre del pedido:", background=COLOR_PANEL, foreground=COLOR_TEXTO).grid(
      row=1, column=0, sticky=tk.W, padx=16, pady=4
    )
    entry_nombre = ttk.Entry(d, width=36, font=("Segoe UI", 11))
    entry_nombre.grid(row=1, column=1, padx=8, pady=4)
    entry_nombre.focus_set()

    ttk.Label(d, text="Precio (COP):", background=COLOR_PANEL, foreground=COLOR_TEXTO).grid(
      row=2, column=0, sticky=tk.W, padx=16, pady=4
    )
    entry_precio = ttk.Entry(d, width=36, font=("Segoe UI", 11))
    entry_precio.grid(row=2, column=1, padx=8, pady=4)
    ttk.Label(
      d,
      text="Ej: 50000 o 50.000",
      background=COLOR_PANEL,
      foreground="#888",
      font=("Segoe UI", 8),
    ).grid(row=3, column=1, sticky=tk.W, padx=8)

    ttk.Label(d, text="Cantidad:", background=COLOR_PANEL, foreground=COLOR_TEXTO).grid(
      row=4, column=0, sticky=tk.W, padx=16, pady=4
    )
    spin_cant = ttk.Spinbox(d, from_=1, to=50, width=8, font=("Segoe UI", 11))
    spin_cant.set("1")
    spin_cant.grid(row=4, column=1, sticky=tk.W, padx=8, pady=4)

    ttk.Label(d, text="Notas cocina:", background=COLOR_PANEL, foreground=COLOR_TEXTO).grid(
      row=5, column=0, sticky=tk.W, padx=16, pady=4
    )
    entry_notas = ttk.Entry(d, width=36, font=("Segoe UI", 11))
    entry_notas.grid(row=5, column=1, padx=8, pady=4)

    def confirmar() -> None:
      try:
        precio = parsear_precio(entry_precio.get())
        cantidad = int(spin_cant.get())
        if cantidad < 1:
          raise ValueError("Cantidad inválida")
        self.carrito.agregar_personalizado(
          categoria=categoria,
          nombre=entry_nombre.get(),
          precio=precio,
          cantidad=cantidad,
          notas=entry_notas.get().strip(),
        )
        self._actualizar_carrito()
        self.bell()
        d.destroy()
      except ValueError as e:
        messagebox.showerror("Error", str(e), parent=d)

    fb = ttk.Frame(d, style="Panel.TFrame")
    fb.grid(row=6, column=0, columnspan=2, pady=16)
    tk.Button(
      fb, text="Agregar al carrito", bg=COLOR_OK, fg="white",
      font=("Segoe UI", 10, "bold"), relief=tk.FLAT, padx=14, pady=8, command=confirmar,
    ).pack(side=tk.LEFT, padx=6)
    tk.Button(
      fb, text="Cancelar", bg="#666", fg="white",
      font=("Segoe UI", 10), relief=tk.FLAT, padx=14, pady=8, command=d.destroy,
    ).pack(side=tk.LEFT, padx=6)

    entry_nombre.bind("<Return>", lambda e: entry_precio.focus_set())
    entry_precio.bind("<Return>", lambda e: confirmar())
    d.bind("<Escape>", lambda e: d.destroy())

  def _dialogo_notas(self, nombre_producto: str) -> str | bool:
    """Retorna str (notas), '' si vacío, False si canceló."""
    d = tk.Toplevel(self)
    d.title(f"Agregar: {nombre_producto}")
    d.configure(bg=COLOR_PANEL)
    d.transient(self)
    d.grab_set()
    d.resizable(False, False)

    ttk.Label(
      d,
      text=f"¿Notas para cocina?\n(ej. Sin cebolla, extra queso)",
      background=COLOR_PANEL,
      foreground=COLOR_TEXTO,
      font=("Segoe UI", 10),
    ).pack(padx=20, pady=(14, 6))

    entry = ttk.Entry(d, width=42, font=("Segoe UI", 11))
    entry.pack(padx=20, pady=8)
    entry.focus_set()

    resultado: list[str | bool] = [""]

    def ok() -> None:
      resultado[0] = entry.get().strip()
      d.destroy()

    def omitir() -> None:
      resultado[0] = ""
      d.destroy()

    def cancelar() -> None:
      resultado[0] = False
      d.destroy()

    fb = ttk.Frame(d, style="Panel.TFrame")
    fb.pack(pady=12)
    tk.Button(fb, text="Agregar", bg=COLOR_OK, fg="white", font=("Segoe UI", 10, "bold"), relief=tk.FLAT, padx=12, pady=6, command=ok).pack(side=tk.LEFT, padx=4)
    tk.Button(fb, text="Sin notas", bg=COLOR_BOTON, fg="white", font=("Segoe UI", 10), relief=tk.FLAT, padx=12, pady=6, command=omitir).pack(side=tk.LEFT, padx=4)
    tk.Button(fb, text="Cancelar", bg="#666", fg="white", font=("Segoe UI", 10), relief=tk.FLAT, padx=12, pady=6, command=cancelar).pack(side=tk.LEFT, padx=4)

    entry.bind("<Return>", lambda e: ok())
    d.bind("<Escape>", lambda e: cancelar())
    self.wait_window(d)
    return resultado[0]

  def _actualizar_carrito(self) -> None:
    for item in self.tree.get_children():
      self.tree.delete(item)

    for _, linea in self.carrito.ver_resumen():
      if linea.es_personalizado:
        tag = "personalizado"
      elif linea.es_bebida_incluida:
        tag = "bebida"
      else:
        tag = ""
      nombre = linea.producto_nombre
      if linea.notas_modificacion:
        nombre += f" ({linea.notas_modificacion})"
      self.tree.insert(
        "",
        tk.END,
        values=(linea.cantidad, nombre, formatear_pesos(linea.subtotal)),
        tags=(tag,),
      )

    self.tree.tag_configure("bebida", foreground=COLOR_ACENTO_SEC)
    self.tree.tag_configure("personalizado", foreground="#FF9F1A")
    self.lbl_total.config(text=f"TOTAL: {formatear_pesos(self.carrito.subtotal())}")

  def _quitar(self) -> None:
    if self.carrito.quitar_ultima_linea():
      self._actualizar_carrito()
    else:
      messagebox.showinfo("Carrito", "El carrito está vacío.", parent=self)

  def _vaciar(self) -> None:
    if self.carrito.esta_vacio():
      return
    if messagebox.askyesno("Vaciar", "¿Eliminar todos los productos del carrito?", parent=self):
      self.carrito.limpiar()
      self._actualizar_carrito()

  def _cobrar(self) -> None:
    if self.carrito.esta_vacio():
      messagebox.showinfo("Cobrar", "Agregue productos al carrito primero.", parent=self)
      return

    d = tk.Toplevel(self)
    d.title("Cerrar venta")
    d.configure(bg=COLOR_PANEL)
    d.transient(self)
    d.grab_set()
    d.resizable(False, False)

    total_txt = formatear_pesos(self.carrito.subtotal())
    ttk.Label(
      d,
      text=f"Total a cobrar: {total_txt}",
      font=("Segoe UI", 14, "bold"),
      background=COLOR_PANEL,
      foreground="#ffd700",
    ).grid(row=0, column=0, columnspan=3, padx=20, pady=(16, 12))

    ttk.Label(d, text="Tipo de entrega:", background=COLOR_PANEL, foreground=COLOR_TEXTO).grid(row=1, column=0, sticky=tk.W, padx=16, pady=6)
    var_entrega = tk.StringVar(value=TIPOS_ENTREGA[0])
    fe = ttk.Frame(d, style="Panel.TFrame")
    fe.grid(row=1, column=1, columnspan=2, sticky=tk.W)
    for t in TIPOS_ENTREGA:
      tk.Radiobutton(
        fe, text=t, variable=var_entrega, value=t,
        bg=COLOR_PANEL, fg=COLOR_TEXTO, selectcolor=COLOR_ACENTO,
        activebackground=COLOR_PANEL, font=("Segoe UI", 10),
      ).pack(side=tk.LEFT, padx=8)

    ttk.Label(d, text="Método de pago:", background=COLOR_PANEL, foreground=COLOR_TEXTO).grid(row=2, column=0, sticky=tk.W, padx=16, pady=6)
    var_pago = tk.StringVar(value=METODOS_PAGO[0])
    fp = ttk.Frame(d, style="Panel.TFrame")
    fp.grid(row=2, column=1, columnspan=2, sticky=tk.W)
    for m in METODOS_PAGO:
      tk.Radiobutton(
        fp, text=m, variable=var_pago, value=m,
        bg=COLOR_PANEL, fg=COLOR_TEXTO, selectcolor=COLOR_ACENTO,
        activebackground=COLOR_PANEL, font=("Segoe UI", 10),
      ).pack(side=tk.LEFT, padx=8)

    nequi_numero = get_config("nequi_numero", NEQUI_NUMERO)
    self.lbl_nequi = ttk.Label(
      d,
      text=f"Nequi: {nequi_numero}",
      background=COLOR_PANEL,
      foreground="#7cb342",
      font=("Segoe UI", 9),
    )
    self.lbl_nequi.grid(row=3, column=0, columnspan=3, pady=4)

    def actualizar_nequi(*_args: object) -> None:
      if var_pago.get() == "Nequi":
        self.lbl_nequi.grid()
      else:
        self.lbl_nequi.grid_remove()

    var_pago.trace_add("write", actualizar_nequi)
    actualizar_nequi()

    ttk.Label(d, text="Teléfono cliente:", background=COLOR_PANEL, foreground=COLOR_TEXTO).grid(row=4, column=0, sticky=tk.W, padx=16, pady=6)
    entry_tel = ttk.Entry(d, width=22, font=("Segoe UI", 11))
    entry_tel.grid(row=4, column=1, columnspan=2, sticky=tk.W, pady=6)

    def confirmar() -> None:
      # Bloque crítico: si falla la BD el carrito NO se toca y el cajero puede reintentar
      try:
        id_f = siguiente_id_factura()
        fh = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
        factura = self.carrito.construir_factura(
          id_factura=id_f,
          fecha_hora=fh,
          metodo_pago=var_pago.get(),
          tipo_entrega=var_entrega.get(),
          telefono_cliente=entry_tel.get().strip(),
        )
        guardar_factura(factura)
      except ErrorBaseDatos as e:
        messagebox.showerror(
          "Error al guardar la venta",
          f"No se pudo registrar en la base de datos.\n\n"
          f"El carrito no fue modificado — puede reintentar.\n\n"
          f"Verifique que MySQL (XAMPP) esté corriendo.\n\n"
          f"Detalle: {e}",
          parent=d,
        )
        return
      except Exception as e:
        messagebox.showerror(
          "Error inesperado",
          f"Ocurrió un error al procesar la venta.\n\n"
          f"El carrito no fue modificado.\n\nDetalle: {e}",
          parent=d,
        )
        return

      # Tickets: no-crítico. Si falla el disco la venta ya está en BD.
      try:
        ruta_cocina, ruta_cliente = guardar_tickets(factura)
      except Exception:
        ruta_cocina, ruta_cliente = "", ""

      # Limpiar estado SOLO después de confirmar que la BD aceptó la venta
      d.destroy()
      if len(self.pedidos) > 1:
        del self.pedidos[self.mesa_actual]
        self.mesa_actual = list(self.pedidos.keys())[0]
        self.combo_mesas["values"] = list(self.pedidos.keys())
        self.var_mesa.set(self.mesa_actual)
      else:
        self.carrito.limpiar()

      self._actualizar_carrito()

      ventana_ticket = tk.Toplevel(self)
      ventana_ticket.title(f"Venta {id_f} — {etiqueta_pago(factura.metodo_pago)}")
      ventana_ticket.geometry("480x560")
      ventana_ticket.configure(bg=COLOR_PANEL)

      color_pago = "#7cb342" if es_nequi(factura.metodo_pago) else "#64b5f6"
      banner = tk.Label(
        ventana_ticket,
        text=f"  PAGO: {etiqueta_pago(factura.metodo_pago).upper()}  —  "
             f"{formatear_pesos(factura.total_pagar)}  ",
        font=("Segoe UI", 12, "bold"),
        bg=color_pago,
        fg="white",
        pady=8,
      )
      banner.pack(fill=tk.X)

      txt = scrolledtext.ScrolledText(
        ventana_ticket,
        font=("Consolas", 10),
        bg="#111",
        fg="#eee",
        wrap=tk.WORD,
      )
      txt.pack(fill=tk.BOTH, expand=True, padx=10, pady=10)
      txt.insert(tk.END, "=== CLIENTE ===\n\n")
      txt.insert(tk.END, ticket_cliente(factura))
      txt.insert(tk.END, "\n\n=== COCINA ===\n\n")
      txt.insert(tk.END, ticket_cocina(factura))
      txt.insert(tk.END, f"\n\nGuardado en:\n{ruta_cliente}\n{ruta_cocina}")
      txt.config(state=tk.DISABLED)

      pago_txt = etiqueta_pago(factura.metodo_pago)
      messagebox.showinfo(
        "Venta registrada",
        f"Factura: {id_f}\n"
        f"Total: {formatear_pesos(factura.total_pagar)}\n"
        f"Pago: {pago_txt}\n"
        f"Entrega: {factura.tipo_entrega}\n\n"
        "Tickets guardados correctamente.",
        parent=self,
      )

    fb = ttk.Frame(d, style="Panel.TFrame")
    fb.grid(row=5, column=0, columnspan=3, pady=16)
    tk.Button(
      fb,
      text=f"Confirmar cobro {total_txt}",
      bg=COLOR_OK,
      fg="white",
      font=("Segoe UI", 11, "bold"),
      relief=tk.FLAT,
      padx=20,
      pady=10,
      cursor="hand2",
      command=confirmar,
    ).pack(side=tk.LEFT, padx=8)
    tk.Button(
      fb,
      text="Cancelar",
      bg="#666",
      fg="white",
      font=("Segoe UI", 10),
      relief=tk.FLAT,
      padx=16,
      pady=10,
      command=d.destroy,
    ).pack(side=tk.LEFT, padx=8)

  def _mostrar_detalle_venta(self, id_factura: str, parent: tk.Toplevel | None = None) -> None:
    venta = obtener_venta_por_id(id_factura)
    if not venta:
      messagebox.showerror("Error", "No se encontró la venta.", parent=parent or self)
      return

    d = tk.Toplevel(parent or self)
    d.title(f"Detalle {id_factura}")
    d.geometry("460x480")
    d.configure(bg=COLOR_PANEL)
    d.transient(parent or self)

    pago = venta["metodo_pago"]
    color_pago = "#7cb342" if es_nequi(pago) else "#64b5f6"
    tk.Label(
      d,
      text=f"PAGO: {etiqueta_pago(pago).upper()}",
      font=("Segoe UI", 14, "bold"),
      bg=color_pago,
      fg="white",
      pady=10,
    ).pack(fill=tk.X)

    info = (
      f"Factura: {venta['id_factura']}\n"
      f"Fecha: {venta['fecha_hora']}\n"
      f"Entrega: {venta['tipo_entrega']}\n"
      f"Teléfono: {venta['telefono_cliente'] or '—'}\n"
      f"Total: {formatear_pesos(venta['total_pagar'])}"
    )
    ttk.Label(d, text=info, background=COLOR_PANEL, foreground=COLOR_TEXTO, font=("Segoe UI", 10)).pack(
      anchor=tk.W, padx=16, pady=8
    )

    tree = ttk.Treeview(d, columns=("cant", "producto", "sub"), show="headings", height=12)
    tree.heading("cant", text="Cant.")
    tree.heading("producto", text="Producto")
    tree.heading("sub", text="Subtotal")
    tree.column("cant", width=45, anchor=tk.CENTER)
    tree.column("producto", width=260)
    tree.column("sub", width=90, anchor=tk.E)
    tree.pack(fill=tk.BOTH, expand=True, padx=12, pady=8)

    for item in venta["items"]:
      sub = item["cantidad"] * item["precio_unitario"]
      tree.insert(
        "",
        tk.END,
        values=(item["cantidad"], item["producto"], formatear_pesos(sub)),
      )

    ttk.Label(
      d,
      text="Doble clic en una venta del listado para ver este detalle.",
      background=COLOR_PANEL,
      foreground="#888",
      font=("Segoe UI", 8),
    ).pack(pady=4)

  def _ver_cuadre(self) -> None:
    d = tk.Toplevel(self)
    d.title("Cuadre de caja")
    d.geometry("720x520")
    d.configure(bg=COLOR_PANEL)
    d.transient(self)

    top = ttk.Frame(d, style="Panel.TFrame")
    top.pack(fill=tk.X, padx=16, pady=(16, 8))
    ttk.Label(top, text="Fecha (YYYY-MM-DD, vacío = hoy):", background=COLOR_PANEL, foreground=COLOR_TEXTO).pack(side=tk.LEFT)
    entry_fecha = ttk.Entry(top, width=14)
    entry_fecha.pack(side=tk.LEFT, padx=8)

    paned = ttk.PanedWindow(d, orient=tk.VERTICAL)
    paned.pack(fill=tk.BOTH, expand=True, padx=16, pady=8)

    frame_resumen = ttk.LabelFrame(paned, text=" Resumen del día ", padding=8)
    paned.add(frame_resumen, weight=1)
    txt_resumen = scrolledtext.ScrolledText(frame_resumen, height=6, font=("Consolas", 10), bg="#111", fg="#eee")
    txt_resumen.pack(fill=tk.BOTH, expand=True)

    frame_detalle = ttk.LabelFrame(paned, text=" Cada compra (Nequi o Efectivo) ", padding=8)
    paned.add(frame_detalle, weight=2)

    tree = ttk.Treeview(
      frame_detalle,
      columns=("hora", "factura", "pago", "entrega", "total"),
      show="headings",
      height=12,
    )
    for col, titulo, ancho in [
      ("hora", "Hora", 130),
      ("factura", "Factura", 120),
      ("pago", "Método de pago", 120),
      ("entrega", "Entrega", 80),
      ("total", "Total", 100),
    ]:
      tree.heading(col, text=titulo)
      tree.column(col, width=ancho)
    tree.pack(fill=tk.BOTH, expand=True)
    tree.tag_configure("nequi", foreground="#7cb342")
    tree.tag_configure("efectivo", foreground="#64b5f6")

    def calcular() -> None:
      fecha = entry_fecha.get().strip() or None
      r = reporte_cuadre_caja(fecha)
      txt_resumen.config(state=tk.NORMAL)
      txt_resumen.delete("1.0", tk.END)
      txt_resumen.insert(
        tk.END,
        f"CUADRE — {r['fecha']}\n"
        f"{'=' * 40}\n"
        f"Facturas del día: {r['facturas']}\n"
        f"Total general:    {formatear_pesos(r['total_general'])}\n\n"
        f"EFECTIVO: {r['efectivo']['cantidad']} ventas  →  {formatear_pesos(r['efectivo']['total'])}\n"
        f"NEQUI:    {r['nequi']['cantidad']} ventas  →  {formatear_pesos(r['nequi']['total'])}\n",
      )
      txt_resumen.config(state=tk.DISABLED)

      for item in tree.get_children():
        tree.delete(item)
      for v in r.get("detalle", []):
        tag = "nequi" if es_nequi(v["metodo_pago"]) else "efectivo"
        hora = v["fecha_hora"].replace("T", " ")[:16]
        tree.insert(
          "",
          tk.END,
          values=(
            hora,
            v["id_factura"],
            etiqueta_pago(v["metodo_pago"]),
            v["tipo_entrega"],
            formatear_pesos(v["total_pagar"]),
          ),
          tags=(tag,),
          iid=v["id_factura"],
        )

    def al_doble_clic(_event: tk.Event) -> None:
      sel = tree.selection()
      if sel:
        self._mostrar_detalle_venta(sel[0], parent=d)

    tree.bind("<Double-1>", al_doble_clic)

    fb = ttk.Frame(d, style="Panel.TFrame")
    fb.pack(pady=8)
    tk.Button(fb, text="Calcular", bg=COLOR_BOTON, fg="white", relief=tk.FLAT, padx=12, pady=6, command=calcular).pack()
    calcular()

  def _ver_ventas(self) -> None:
    d = tk.Toplevel(self)
    d.title("Historial de ventas")
    d.geometry("760x480")
    d.configure(bg=COLOR_PANEL)
    d.transient(self)

    filtro_frame = ttk.Frame(d, style="Panel.TFrame")
    filtro_frame.pack(fill=tk.X, padx=12, pady=(12, 4))
    ttk.Label(
      filtro_frame,
      text="Filtrar por pago:",
      background=COLOR_PANEL,
      foreground=COLOR_TEXTO,
    ).pack(side=tk.LEFT)

    var_filtro = tk.StringVar(value="todos")
    todas_ventas: list[dict] = []

    def recargar() -> None:
      nonlocal todas_ventas
      todas_ventas = listar_ventas(limite=100)
      aplicar_filtro()

    def aplicar_filtro() -> None:
      for item in tree.get_children():
        tree.delete(item)
      f = var_filtro.get()
      for v in todas_ventas:
        if f == "efectivo" and v["metodo_pago"] != "Efectivo":
          continue
        if f == "nequi" and v["metodo_pago"] != "Nequi":
          continue
        tag = "nequi" if es_nequi(v["metodo_pago"]) else "efectivo"
        tree.insert(
          "",
          tk.END,
          values=(
            v["id_factura"],
            v["fecha_hora"].replace("T", " ")[:16],
            etiqueta_pago(v["metodo_pago"]),
            v["tipo_entrega"],
            formatear_pesos(v["total_pagar"]),
          ),
          tags=(tag,),
          iid=v["id_factura"],
        )

    for texto, valor in [("Todas", "todos"), ("Solo Efectivo", "efectivo"), ("Solo Nequi", "nequi")]:
      tk.Radiobutton(
        filtro_frame,
        text=texto,
        variable=var_filtro,
        value=valor,
        bg=COLOR_PANEL,
        fg=COLOR_TEXTO,
        selectcolor=COLOR_ACENTO,
        activebackground=COLOR_PANEL,
        command=aplicar_filtro,
      ).pack(side=tk.LEFT, padx=10)

    tree = ttk.Treeview(
      d,
      columns=("id", "fecha", "pago", "entrega", "total"),
      show="headings",
      height=16,
    )
    for col, txt, w in [
      ("id", "Factura", 120),
      ("fecha", "Fecha / Hora", 140),
      ("pago", "Método de pago", 110),
      ("entrega", "Entrega", 80),
      ("total", "Total", 100),
    ]:
      tree.heading(col, text=txt)
      tree.column(col, width=w)
    tree.pack(fill=tk.BOTH, expand=True, padx=12, pady=8)
    tree.tag_configure("nequi", foreground="#7cb342")
    tree.tag_configure("efectivo", foreground="#64b5f6")

    ttk.Label(
      d,
      text="Verde = Nequi  |  Azul = Efectivo  |  Doble clic para ver detalle de la compra",
      background=COLOR_PANEL,
      foreground="#aaa",
      font=("Segoe UI", 9),
    ).pack(pady=(0, 10))

    def al_doble_clic(_event: tk.Event) -> None:
      sel = tree.selection()
      if sel:
        self._mostrar_detalle_venta(sel[0], parent=d)

    tree.bind("<Double-1>", al_doble_clic)
    recargar()

    if not todas_ventas:
      messagebox.showinfo("Ventas", "No hay ventas registradas.", parent=d)

  def _exportar_json(self) -> None:
    ruta = exportar_ventas_json()
    messagebox.showinfo("Exportar", f"Archivo generado:\n{ruta}", parent=self)

  def _exportar_excel(self) -> None:
    try:
      ruta = exportar_ventas_excel()
      messagebox.showinfo("Exportar Excel", f"Archivo Excel generado:\n{ruta}", parent=self)
    except Exception as e:
      messagebox.showerror("Error al exportar", str(e), parent=self)

  def _exportar_backup(self) -> None:
    from pathlib import Path
    from tkinter import filedialog
    ts = datetime.now().strftime("%Y%m%d_%H%M%S")
    ruta = filedialog.asksaveasfilename(
      parent=self,
      initialfile=f"backup_alvarez_{ts}.sql",
      defaultextension=".sql",
      filetypes=[("SQL backup", "*.sql"), ("Todos los archivos", "*.*")],
      title="Guardar backup de la base de datos",
    )
    if not ruta:
      return
    try:
      archivo = hacer_backup(destino=Path(ruta))
      messagebox.showinfo(
        "Backup guardado",
        f"Backup generado correctamente:\n{archivo}",
        parent=self,
      )
    except Exception as e:
      messagebox.showerror("Error en backup", str(e), parent=self)

  # ------------------------------------------------------------------
  # Admin: PIN + Configuración + CRUD Productos
  # ------------------------------------------------------------------

  def _ventana_admin_productos(self) -> None:
    """Ventana CRUD de productos, protegida por PIN."""
    if not self._verificar_pin():
      return

    d = tk.Toplevel(self)
    d.title("Administracion de Productos")
    d.geometry("780x540")
    d.configure(bg=COLOR_PANEL)
    d.transient(self)

    hdr = ttk.Frame(d, style="Panel.TFrame")
    hdr.pack(fill=tk.X, padx=16, pady=(14, 4))
    ttk.Label(hdr, text="Productos del menu", font=("Segoe UI", 13, "bold"),
              background=COLOR_PANEL, foreground=COLOR_ACENTO).pack(side=tk.LEFT)
    ttk.Label(hdr, text="  Verde = activo  |  Gris = desactivado  |  Doble clic para editar",
              font=("Segoe UI", 9), background=COLOR_PANEL,
              foreground=COLOR_MUTED).pack(side=tk.LEFT)

    frame_tree = ttk.Frame(d, style="Panel.TFrame")
    frame_tree.pack(fill=tk.BOTH, expand=True, padx=16, pady=6)

    cols = ("categoria", "nombre", "precio", "estado")
    tree = ttk.Treeview(frame_tree, columns=cols, show="headings", height=16)
    for col, titulo, ancho, anc in [
      ("categoria", "Categoria",  140, tk.W),
      ("nombre",    "Nombre",     290, tk.W),
      ("precio",    "Precio",     100, tk.E),
      ("estado",    "Estado",      80, tk.CENTER),
    ]:
      tree.heading(col, text=titulo)
      tree.column(col, width=ancho, anchor=anc)

    sb = ttk.Scrollbar(frame_tree, orient=tk.VERTICAL, command=tree.yview)
    tree.configure(yscrollcommand=sb.set)
    tree.pack(side=tk.LEFT, fill=tk.BOTH, expand=True)
    sb.pack(side=tk.RIGHT, fill=tk.Y)
    tree.tag_configure("activo",   foreground="#7cb342")
    tree.tag_configure("inactivo", foreground="#556677")

    def recargar() -> None:
      for item in tree.get_children():
        tree.delete(item)
      for p in listar_productos(solo_activos=False):
        tag = "activo" if p.activo else "inactivo"
        tree.insert("", tk.END, iid=p.id, values=(
          p.categoria,
          p.nombre,
          formatear_pesos(p.precio),
          "Activo" if p.activo else "Desactivado",
        ), tags=(tag,))

    def editar_seleccionado() -> None:
      sel = tree.selection()
      if not sel:
        messagebox.showinfo("Editar", "Seleccione un producto primero.", parent=d)
        return
      pid = sel[0]
      prod = next((p for p in listar_productos(solo_activos=False) if p.id == pid), None)
      if prod:
        self._dialogo_producto(parent=d, producto=prod, callback=recargar)

    def toggle_seleccionado() -> None:
      sel = tree.selection()
      if not sel:
        messagebox.showinfo("Activar/Desactivar",
                            "Seleccione un producto primero.", parent=d)
        return
      try:
        nuevo = toggle_activo_producto(sel[0])
        txt = "activado" if nuevo else "desactivado"
        messagebox.showinfo("Listo", f"Producto {txt}.", parent=d)
        recargar()
        # Refresca los botones de la pantalla principal al volver
        if self._categoria_actual:
          self._mostrar_productos_categoria(self._categoria_actual)
      except Exception as e:
        messagebox.showerror("Error", str(e), parent=d)

    tree.bind("<Double-1>", lambda _e: editar_seleccionado())

    btns = ttk.Frame(d, style="Panel.TFrame")
    btns.pack(fill=tk.X, padx=16, pady=(4, 14))
    tk.Button(btns, text="+ Nuevo producto", bg=COLOR_OK, fg="white",
              font=("Segoe UI", 10, "bold"), relief=tk.FLAT, padx=14, pady=8,
              cursor="hand2",
              command=lambda: self._dialogo_producto(
                parent=d, producto=None, callback=recargar)).pack(side=tk.LEFT, padx=4)
    tk.Button(btns, text="Editar seleccionado", bg=COLOR_BOTON, fg=COLOR_TEXTO,
              font=("Segoe UI", 10), relief=tk.FLAT, padx=14, pady=8,
              cursor="hand2", command=editar_seleccionado).pack(side=tk.LEFT, padx=4)
    tk.Button(btns, text="Activar / Desactivar", bg="#e94560", fg="white",
              font=("Segoe UI", 10), relief=tk.FLAT, padx=14, pady=8,
              cursor="hand2", command=toggle_seleccionado).pack(side=tk.LEFT, padx=4)
    tk.Button(btns, text="Cerrar", bg="#444", fg="white",
              font=("Segoe UI", 10), relief=tk.FLAT, padx=14, pady=8,
              command=d.destroy).pack(side=tk.RIGHT, padx=4)

    recargar()
    d.bind("<Escape>", lambda _e: d.destroy())

  def _dialogo_producto(
    self,
    parent: tk.Toplevel,
    producto: Producto | None,
    callback,
  ) -> None:
    """Formulario modal para crear o editar un producto."""
    es_nuevo = producto is None
    titulo = "Nuevo producto" if es_nuevo else f"Editar: {producto.nombre}"

    d = tk.Toplevel(parent)
    d.title(titulo)
    d.configure(bg=COLOR_PANEL)
    d.transient(parent)
    d.grab_set()
    d.resizable(False, False)

    ttk.Label(d, text=titulo, font=("Segoe UI", 12, "bold"),
              background=COLOR_PANEL, foreground=COLOR_ACENTO).grid(
      row=0, column=0, columnspan=2, padx=24, pady=(18, 12))

    # --- Campos de texto ---
    def _campo(fila: int, label: str, valor: str, ancho: int = 38) -> ttk.Entry:
      ttk.Label(d, text=label, background=COLOR_PANEL,
                foreground=COLOR_TEXTO).grid(row=fila, column=0, sticky=tk.W, padx=20, pady=5)
      e = ttk.Entry(d, width=ancho, font=("Segoe UI", 11))
      e.insert(0, valor)
      e.grid(row=fila, column=1, padx=12, pady=5)
      return e

    entry_nombre = _campo(1, "Nombre del producto:", producto.nombre if producto else "")
    entry_precio = _campo(2, "Precio (COP):",        str(producto.precio) if producto else "")
    entry_ingr   = _campo(3, "Ingredientes (opcional):", producto.ingredientes if producto else "")

    # --- Categoría: combobox editable ---
    ttk.Label(d, text="Categoria:", background=COLOR_PANEL,
              foreground=COLOR_TEXTO).grid(row=4, column=0, sticky=tk.W, padx=20, pady=5)
    cats = categorias_activas() or ["PICADAS"]
    var_cat = tk.StringVar(value=producto.categoria if producto else cats[0])
    combo = ttk.Combobox(d, textvariable=var_cat, values=cats,
                         width=36, font=("Segoe UI", 11))
    combo.grid(row=4, column=1, padx=12, pady=5)
    ttk.Label(d, text="Puede escribir una nueva categoria (ej: COMBOS).",
              background=COLOR_PANEL, foreground=COLOR_MUTED,
              font=("Segoe UI", 8)).grid(row=5, column=1, sticky=tk.W, padx=12)

    def guardar() -> None:
      nombre    = entry_nombre.get().strip()
      precio_t  = entry_precio.get().strip()
      ingr      = entry_ingr.get().strip()
      categoria = var_cat.get().strip().upper()

      if not nombre:
        messagebox.showerror("Error", "El nombre no puede estar vacio.", parent=d)
        return
      if not categoria:
        messagebox.showerror("Error", "Escriba o seleccione una categoria.", parent=d)
        return
      try:
        precio = parsear_precio(precio_t)
      except ValueError as err:
        messagebox.showerror("Precio invalido", str(err), parent=d)
        return

      try:
        if es_nuevo:
          crear_producto(nombre=nombre, precio=precio,
                         categoria=categoria, ingredientes=ingr)
        else:
          actualizar_producto(producto_id=producto.id, nombre=nombre,
                              precio=precio, categoria=categoria,
                              ingredientes=ingr)
        callback()
        # Refresca la pantalla principal si la categoria editada es la actual
        if self._categoria_actual == categoria or (
            not es_nuevo and self._categoria_actual == producto.categoria
        ):
          self._mostrar_productos_categoria(self._categoria_actual)
        d.destroy()
      except Exception as err:
        messagebox.showerror("Error al guardar", str(err), parent=d)

    fb = ttk.Frame(d, style="Panel.TFrame")
    fb.grid(row=6, column=0, columnspan=2, pady=18)
    tk.Button(fb, text="Guardar", bg=COLOR_OK, fg="white",
              font=("Segoe UI", 10, "bold"), relief=tk.FLAT, padx=16, pady=8,
              command=guardar).pack(side=tk.LEFT, padx=8)
    tk.Button(fb, text="Cancelar", bg="#666", fg="white",
              font=("Segoe UI", 10), relief=tk.FLAT, padx=16, pady=8,
              command=d.destroy).pack(side=tk.LEFT, padx=8)

    entry_nombre.focus_set()
    entry_nombre.bind("<Return>", lambda _e: entry_precio.focus_set())
    entry_precio.bind("<Return>", lambda _e: guardar())
    d.bind("<Escape>", lambda _e: d.destroy())

  def _verificar_pin(self, parent: tk.Toplevel | None = None) -> bool:
    """Muestra diálogo de PIN. Devuelve True si el PIN ingresado es correcto."""
    ventana = parent or self
    pin_correcto = get_config("pin_admin", "1234")
    resultado: list[bool] = [False]

    d = tk.Toplevel(ventana)
    d.title("Acceso restringido")
    d.configure(bg=COLOR_PANEL)
    d.transient(ventana)
    d.grab_set()
    d.resizable(False, False)

    ttk.Label(
      d,
      text="Ingrese el PIN de administracion:",
      background=COLOR_PANEL,
      foreground=COLOR_TEXTO,
      font=("Segoe UI", 11),
    ).pack(padx=28, pady=(22, 8))

    entry_pin = ttk.Entry(d, width=10, font=("Segoe UI", 22), show="*", justify="center")
    entry_pin.pack(padx=28, pady=8)
    entry_pin.focus_set()

    lbl_error = ttk.Label(
      d, text="", background=COLOR_PANEL,
      foreground=COLOR_ACENTO, font=("Segoe UI", 9),
    )
    lbl_error.pack(pady=2)

    def verificar() -> None:
      if entry_pin.get() == pin_correcto:
        resultado[0] = True
        d.destroy()
      else:
        lbl_error.config(text="PIN incorrecto. Intente de nuevo.")
        entry_pin.delete(0, tk.END)
        entry_pin.focus_set()

    fb = ttk.Frame(d, style="Panel.TFrame")
    fb.pack(pady=(8, 18))
    tk.Button(
      fb, text="Ingresar", bg=COLOR_OK, fg="white",
      font=("Segoe UI", 10, "bold"), relief=tk.FLAT, padx=14, pady=8,
      command=verificar,
    ).pack(side=tk.LEFT, padx=6)
    tk.Button(
      fb, text="Cancelar", bg="#666", fg="white",
      font=("Segoe UI", 10), relief=tk.FLAT, padx=14, pady=8,
      command=d.destroy,
    ).pack(side=tk.LEFT, padx=6)

    entry_pin.bind("<Return>", lambda e: verificar())
    d.bind("<Escape>", lambda e: d.destroy())
    self.wait_window(d)
    return resultado[0]

  def _ventana_configuracion(self) -> None:
    """Ventana de configuración del sistema, protegida por PIN."""
    if not self._verificar_pin():
      return

    d = tk.Toplevel(self)
    d.title("Configuracion del sistema")
    d.configure(bg=COLOR_PANEL)
    d.transient(self)
    d.grab_set()
    d.resizable(False, False)

    ttk.Label(
      d,
      text="Configuracion",
      font=("Segoe UI", 14, "bold"),
      background=COLOR_PANEL,
      foreground=COLOR_ACENTO,
    ).grid(row=0, column=0, columnspan=2, padx=28, pady=(22, 16))

    # Campos editables: etiqueta → clave en BD
    campos = [
      ("Nombre del restaurante:", "nombre_restaurante"),
      ("Numero Nequi:", "nequi_numero"),
      ("Mensaje en ticket (domicilio):", "domicilio_mensaje"),
    ]

    entries: dict[str, ttk.Entry] = {}
    for i, (label, clave) in enumerate(campos, start=1):
      ttk.Label(
        d, text=label, background=COLOR_PANEL, foreground=COLOR_TEXTO,
      ).grid(row=i, column=0, sticky=tk.W, padx=20, pady=6)
      entry = ttk.Entry(d, width=36, font=("Segoe UI", 11))
      entry.insert(0, get_config(clave, ""))
      entry.grid(row=i, column=1, padx=12, pady=6)
      entries[clave] = entry

    # PIN con confirmación
    fila_pin = len(campos) + 1
    ttk.Label(
      d, text="Nuevo PIN (4 digitos):", background=COLOR_PANEL, foreground=COLOR_TEXTO,
    ).grid(row=fila_pin, column=0, sticky=tk.W, padx=20, pady=6)
    entry_pin1 = ttk.Entry(d, width=36, font=("Segoe UI", 11), show="*")
    entry_pin1.grid(row=fila_pin, column=1, padx=12, pady=6)

    ttk.Label(
      d, text="Confirmar PIN:", background=COLOR_PANEL, foreground=COLOR_TEXTO,
    ).grid(row=fila_pin + 1, column=0, sticky=tk.W, padx=20, pady=6)
    entry_pin2 = ttk.Entry(d, width=36, font=("Segoe UI", 11), show="*")
    entry_pin2.grid(row=fila_pin + 1, column=1, padx=12, pady=6)

    ttk.Label(
      d,
      text="Deje los campos de PIN vacios para no cambiarlo.",
      background=COLOR_PANEL,
      foreground=COLOR_MUTED,
      font=("Segoe UI", 8),
    ).grid(row=fila_pin + 2, column=0, columnspan=2, padx=20, pady=(0, 4))

    def guardar() -> None:
      pin_nuevo = entry_pin1.get().strip()
      pin_conf = entry_pin2.get().strip()

      if pin_nuevo or pin_conf:
        if len(pin_nuevo) != 4 or not pin_nuevo.isdigit():
          messagebox.showerror("PIN invalido", "El PIN debe tener exactamente 4 digitos numericos.", parent=d)
          return
        if pin_nuevo != pin_conf:
          messagebox.showerror("PIN no coincide", "Los dos campos de PIN no son iguales.", parent=d)
          return

      try:
        for clave, entry in entries.items():
          valor = entry.get().strip()
          if valor:
            set_config(clave, valor)
        if pin_nuevo:
          set_config("pin_admin", pin_nuevo)
        messagebox.showinfo("Guardado", "Configuracion actualizada correctamente.", parent=d)
        d.destroy()
      except Exception as e:
        messagebox.showerror("Error", f"No se pudo guardar la configuracion:\n{e}", parent=d)

    fila_btn = fila_pin + 3
    fb = ttk.Frame(d, style="Panel.TFrame")
    fb.grid(row=fila_btn, column=0, columnspan=2, pady=18)
    tk.Button(
      fb, text="Guardar cambios", bg=COLOR_OK, fg="white",
      font=("Segoe UI", 10, "bold"), relief=tk.FLAT, padx=16, pady=8,
      command=guardar,
    ).pack(side=tk.LEFT, padx=8)
    tk.Button(
      fb, text="Cancelar", bg="#666", fg="white",
      font=("Segoe UI", 10), relief=tk.FLAT, padx=16, pady=8,
      command=d.destroy,
    ).pack(side=tk.LEFT, padx=8)

    d.bind("<Escape>", lambda e: d.destroy())


def iniciar_gui() -> None:
  app = AppVentas()
  app.mainloop()


if __name__ == "__main__":
  iniciar_gui()
