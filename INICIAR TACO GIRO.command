#!/bin/bash
# ── Taco Giro — Servidor ─────────────────────────────────────────
DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
cd "$DIR"

clear
echo ""
echo "  ████████╗ █████╗  ██████╗ ██████╗      ██████╗ ██╗██████╗  ██████╗ "
echo "     ██╔══╝██╔══██╗██╔════╝██╔═══██╗    ██╔════╝ ██║██╔══██╗██╔═══██╗"
echo "     ██║   ███████║██║     ██║   ██║    ██║  ███╗██║██████╔╝██║   ██║"
echo "     ██║   ██╔══██║██║     ██║   ██║    ██║   ██║██║██╔══██╗██║   ██║"
echo "     ██║   ██║  ██║╚██████╗╚██████╔╝    ╚██████╔╝██║██║  ██║╚██████╔╝"
echo "     ╚═╝   ╚═╝  ╚═╝ ╚═════╝ ╚═════╝      ╚═════╝ ╚═╝╚═╝  ╚═╝ ╚═════╝ "
echo ""
echo "  ──────────────────────────────────────────────────────────────────"
echo "  Nogales, Sonora • Desde 2008"
echo "  ──────────────────────────────────────────────────────────────────"
echo ""

# Verificar Node.js
if ! command -v node &> /dev/null; then
  echo "  ❌  Node.js no está instalado."
  echo "      Descárgalo en: https://nodejs.org"
  echo ""
  read -p "  Presiona Enter para cerrar..."
  exit 1
fi

# Verificar dependencias
if [ ! -d "node_modules" ]; then
  echo "  📦  Instalando dependencias (solo la primera vez)..."
  npm install --silent
  echo "  ✅  Dependencias listas."
  echo ""
fi

# Cerrar servidor anterior si existe
PREV=$(lsof -ti:3001 2>/dev/null)
if [ -n "$PREV" ]; then
  echo "  ⚠️   Cerrando servidor anterior..."
  kill -9 $PREV 2>/dev/null
  sleep 1
fi

# Abrir navegadores después de 3 segundos
(sleep 3 && open "http://localhost:3001/web-taco-giro.html" && sleep 1 && open "http://localhost:3001/admin.html") &

echo "  🟢  Iniciando servidor..."
echo ""
echo "  ──────────────────────────────────────────────────────────────────"
echo "  🌐  Web pública  →  http://localhost:3001/web-taco-giro.html"
echo "  📊  Panel Admin  →  http://localhost:3001/admin.html"
echo "  ──────────────────────────────────────────────────────────────────"
echo "  👤  Usuario     :  admin"
echo "  🔑  Contraseña  :  tacogiro2026"
echo "  ──────────────────────────────────────────────────────────────────"
echo ""
echo "  ⚠️   NO CERRAR ESTA VENTANA mientras el restaurante esté abierto."
echo "  Para apagar: Cmd+C o cierra esta ventana."
echo ""

# Iniciar servidor
node server.js
