"""Interfaz de consola interactiva para el cajero."""

from __future__ import annotations

import os
import sys
from datetime import datetime, timezone

from config import METODOS_PAGO, NEQUI_NUMERO, TIPOS_ENTREGA
from logica import Carrito, etiqueta_pago, formatear_pesos, parsear_precio, validar_metodo_pago, validar_tipo_entrega
from menu_data import MENU, categorias_ordenadas
from modelos import Producto
from persistencia import (
  exportar_ventas_json,
  guardar_factura,
  inicializar_bd,
  listar_ventas,
  reporte_cuadre_caja,
  siguiente_id_factura,
)
from tickets import guardar_tickets, ticket_cliente, ticket_cocina


def limpiar_pantalla() -> None:
  os.system("cls" if os.name == "nt" else "clear")


def pausa() -> None:
  input("\n[Enter para continuar]")


def leer_opcion(prompt: str, opciones_validas: list[str]) -> str:
  mapa = {str(i): v for i, v in enumerate(opciones_validas, start=1)}
  while True:
    print(prompt)
    for i, op in enumerate(opciones_validas, start=1):
      print(f"  {i}. {op}")
    eleccion = input("Opción: ").strip()
    if eleccion in mapa:
      return mapa[eleccion]
    if eleccion in opciones_validas:
      return eleccion
    print("Opción no válida. Intente de nuevo.\n")


def leer_entero(prompt: str, minimo: int = 1, maximo: int = 99) -> int:
  while True:
    texto = input(prompt).strip()
    if not texto:
      return 1
    try:
      n = int(texto)
      if minimo <= n <= maximo:
        return n
    except ValueError:
      pass
    print(f"Ingrese un número entre {minimo} y {maximo}.")


def mostrar_banner() -> None:
  print("=" * 48)
  print("   ALVAREZ FAST FOOD - SISTEMA DE VENTAS")
  print("        Edición Copa Mundial 2026")
  print("=" * 48)


def indice_menu_global() -> list[Producto]:
  """Lista plana numerada 1..N para acceso rápido por teclado."""
  return list(MENU)


def mostrar_menu_productos() -> list[Producto]:
  lista = indice_menu_global()
  print("\n--- MENÚ (número rápido) ---\n")
  num = 1
  for cat in categorias_ordenadas():
    print(f"  [{cat}]")
    for p in MENU:
      if p.categoria != cat:
        continue
      print(f"    {num:2d}. {p.nombre:<30} {formatear_pesos(p.precio)}")
      num += 1
    print()
  return lista


def mostrar_carrito(carrito: Carrito) -> None:
  print("\n--- CARRITO ACTUAL ---")
  if carrito.esta_vacio():
    print("  (vacío)")
    return
  for i, linea in carrito.ver_resumen():
    extra = " [personalizado]" if linea.es_personalizado else ""
    nota = f' | "{linea.notas_modificacion}"' if linea.notas_modificacion else ""
    print(
      f"  {i}. {linea.cantidad}x {linea.producto_nombre}{extra} "
      f"= {formatear_pesos(linea.subtotal)}{nota}"
    )
  print(f"\n  TOTAL: {formatear_pesos(carrito.subtotal())}")


def agregar_personalizado(carrito: Carrito) -> None:
  print("\n--- PEDIDO PERSONALIZADO (no está en el menú) ---")
  cats = categorias_ordenadas()
  for i, c in enumerate(cats, start=1):
    print(f"  {i}. {c}")
  idx = leer_entero("\nCategoría: ", minimo=1, maximo=len(cats))
  categoria = cats[idx - 1]
  nombre = input("Nombre del pedido (ej. Salchipapa especial): ").strip()
  precio_txt = input("Precio en COP (ej. 50000): ").strip()
  cantidad = leer_entero("Cantidad [1]: ", minimo=1, maximo=50)
  notas = input("Notas para cocina (opcional): ").strip()
  try:
    precio = parsear_precio(precio_txt)
    carrito.agregar_personalizado(categoria, nombre, precio, cantidad, notas)
    print(f"\n✓ Agregado personalizado: {cantidad}x {nombre} — {formatear_pesos(precio * cantidad)}")
  except ValueError as e:
    print(f"\nError: {e}")


def agregar_al_carrito(carrito: Carrito) -> None:
  lista = mostrar_menu_productos()
  print("  0. Volver")
  print(" 99. Pedido personalizado (nombre y precio a mano)")
  eleccion = input("\nNúmero de producto: ").strip()
  if eleccion == "0":
    return
  if eleccion == "99":
    agregar_personalizado(carrito)
    return

  try:
    idx = int(eleccion)
  except ValueError:
    print("Opción no válida.")
    return
  if idx < 1 or idx > len(lista):
    print("Opción no válida.")
    return

  producto = lista[idx - 1]
  cantidad = leer_entero("Cantidad [1]: ", minimo=1, maximo=20)
  notas = input('Notas (ej. "Sin cebolla", Enter si ninguna): ').strip()

  try:
    carrito.agregar_producto(producto, cantidad, notas)
    print(f"\n✓ Agregado: {cantidad}x {producto.nombre}")
  except ValueError as e:
    print(f"\nError: {e}")


def cobrar_pedido(carrito: Carrito) -> None:
  if carrito.esta_vacio():
    print("\nEl carrito está vacío. Agregue productos primero.")
    return

  mostrar_carrito(carrito)
  print("\n--- CERRAR VENTA ---")

  tipo_entrega = leer_opcion("Tipo de entrega:", list(TIPOS_ENTREGA))
  telefono = input("Teléfono cliente (opcional): ").strip()

  print("\nMétodo de pago:")
  metodo = leer_opcion("", list(METODOS_PAGO))
  if metodo == "Nequi":
    print(f"  Recuerde: Nequi {NEQUI_NUMERO}")

  confirmar = input(
    f"\n¿Confirmar cobro por {formatear_pesos(carrito.subtotal())}? (s/n): "
  ).strip().lower()
  if confirmar not in ("s", "si", "sí", "y", "yes"):
    print("Venta cancelada.")
    return

  id_factura = siguiente_id_factura()
  fecha_hora = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")

  factura = carrito.construir_factura(
    id_factura=id_factura,
    fecha_hora=fecha_hora,
    metodo_pago=metodo,
    tipo_entrega=tipo_entrega,
    telefono_cliente=telefono,
  )

  guardar_factura(factura)
  ruta_cocina, ruta_cliente = guardar_tickets(factura)

  limpiar_pantalla()
  print("\n✓ VENTA REGISTRADA")
  print(f"  Pago: {etiqueta_pago(metodo).upper()} | Entrega: {tipo_entrega}")
  print(f"  Total: {formatear_pesos(factura.total_pagar)}\n")
  print(ticket_cliente(factura))
  print("\n--- TICKET COCINA ---\n")
  print(ticket_cocina(factura))
  print(f"\nTickets guardados en:\n  {ruta_cocina}\n  {ruta_cliente}")

  carrito.limpiar()
  pausa()


def ver_cuadre_caja() -> None:
  fecha = input("Fecha YYYY-MM-DD (Enter = hoy): ").strip() or None
  reporte = reporte_cuadre_caja(fecha)

  print("\n--- CUADRE DE CAJA ---")
  print(f"Fecha: {reporte['fecha']}")
  print(f"Facturas: {reporte['facturas']}")
  print(f"Total general: {formatear_pesos(reporte['total_general'])}")
  print(f"\n  Efectivo: {reporte['efectivo']['cantidad']} ventas — "
        f"{formatear_pesos(reporte['efectivo']['total'])}")
  print(f"  Nequi:    {reporte['nequi']['cantidad']} ventas — "
        f"{formatear_pesos(reporte['nequi']['total'])}")
  print(f"\n--- DETALLE DE CADA COMPRA ---")
  for v in reporte.get("detalle", []):
    print(
      f"  {v['fecha_hora'][:16]} | {v['id_factura']} | "
      f"PAGO: {etiqueta_pago(v['metodo_pago']):<8} | {formatear_pesos(v['total_pagar'])}"
    )
  pausa()


def ver_ultimas_ventas() -> None:
  ventas = listar_ventas(limite=20)
  print("\n--- ÚLTIMAS VENTAS (método de pago por compra) ---")
  if not ventas:
    print("  No hay ventas registradas.")
  else:
    print(f"  {'Factura':<16} {'Fecha':<17} {'Pago':<10} {'Total':>12}")
    print("  " + "-" * 58)
    for v in ventas:
      print(
        f"  {v['id_factura']:<16} {v['fecha_hora'][:16]:<17} "
        f"{etiqueta_pago(v['metodo_pago']):<10} {formatear_pesos(v['total_pagar']):>12}"
      )
  pausa()


def exportar_json() -> None:
  ruta = exportar_ventas_json()
  print(f"\n✓ Exportado a: {ruta}")
  pausa()


def exportar_excel() -> None:
  try:
    from exportar_excel import exportar_ventas_excel
    ruta = exportar_ventas_excel()
    print(f"\n✓ Exportado a Excel: {ruta}")
  except Exception as e:
    print(f"\nError al exportar: {e}")
  pausa()


def menu_principal(carrito: Carrito) -> None:
  while True:
    limpiar_pantalla()
    mostrar_banner()
    mostrar_carrito(carrito)
    print("\n--- OPCIONES ---")
    print("  1. Agregar producto al carrito")
    print("  2. Quitar última línea del carrito")
    print("  3. Vaciar carrito")
    print("  4. Cobrar / cerrar venta")
    print("  5. Cuadre de caja del día")
    print("  6. Ver últimas ventas")
    print("  7. Exportar ventas a JSON (Power BI)")
    print("  8. Exportar ventas a Excel (total vendido)")
    print("  0. Salir")

    op = input("\nOpción: ").strip()

    if op == "1":
      agregar_al_carrito(carrito)
      pausa()
    elif op == "2":
      if carrito.quitar_ultima_linea():
        print("Última línea eliminada.")
      else:
        print("Carrito vacío.")
      pausa()
    elif op == "3":
      carrito.limpiar()
      print("Carrito vaciado.")
      pausa()
    elif op == "4":
      cobrar_pedido(carrito)
    elif op == "5":
      ver_cuadre_caja()
    elif op == "6":
      ver_ultimas_ventas()
    elif op == "7":
      exportar_json()
    elif op == "8":
      exportar_excel()
    elif op == "0":
      print("\nHasta pronto. ¡Buen servicio!")
      sys.exit(0)
    else:
      print("Opción no válida.")
      pausa()


def iniciar() -> None:
  inicializar_bd()
  carrito = Carrito()
  menu_principal(carrito)
