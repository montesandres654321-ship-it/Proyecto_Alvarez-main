#!/usr/bin/env python3
"""Punto de entrada: Alvarez Fast Food — interfaz gráfica (Tkinter)."""

import sys

from gui import iniciar_gui


def main() -> None:
  # Consola solo si se pasa --consola
  if "--consola" in sys.argv:
    from app import iniciar
    iniciar()
  else:
    iniciar_gui()


if __name__ == "__main__":
  main()
