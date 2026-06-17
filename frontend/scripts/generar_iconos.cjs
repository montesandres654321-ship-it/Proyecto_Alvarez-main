const sharp = require('sharp');
const path = require('path');

const svg = `<svg xmlns="http://www.w3.org/2000/svg"
  viewBox="0 0 512 512" width="512" height="512">

  <!-- Fondo negro -->
  <rect width="512" height="512" fill="#000000"/>

  <!-- Círculo exterior verde neón -->
  <circle cx="256" cy="256" r="240"
    fill="none" stroke="#00FF00" stroke-width="12"/>

  <!-- Círculo rosa/magenta fondo -->
  <circle cx="256" cy="256" r="228" fill="#E8008A"/>

  <!-- Círculo interior degradado verde-cyan -->
  <defs>
    <radialGradient id="grad1" cx="50%" cy="50%">
      <stop offset="0%" style="stop-color:#00E5FF"/>
      <stop offset="100%" style="stop-color:#00AA44"/>
    </radialGradient>
  </defs>
  <circle cx="256" cy="256" r="160" fill="url(#grad1)"/>

  <!-- Texto ALVAREZ arriba en arco (simulado horizontal) -->
  <text x="256" y="108"
    font-family="Arial Black, sans-serif"
    font-size="44" font-weight="900"
    fill="#FFD700" stroke="#8B00FF" stroke-width="2"
    text-anchor="middle" letter-spacing="6">
    ALVAREZ
  </text>

  <!-- Hamburguesa (pan superior) -->
  <ellipse cx="256" cy="215" rx="65" ry="22" fill="#D4881A"/>
  <!-- semillas sésamo -->
  <ellipse cx="240" cy="207" rx="5" ry="3" fill="#F5DEB3"
    transform="rotate(-20,240,207)"/>
  <ellipse cx="262" cy="204" rx="5" ry="3" fill="#F5DEB3"
    transform="rotate(10,262,204)"/>
  <ellipse cx="278" cy="210" rx="5" ry="3" fill="#F5DEB3"
    transform="rotate(-10,278,210)"/>
  <!-- lechuga -->
  <ellipse cx="256" cy="228" rx="70" ry="10" fill="#22AA22"/>
  <!-- tomate -->
  <ellipse cx="256" cy="236" rx="66" ry="8" fill="#CC2200"/>
  <!-- carne -->
  <ellipse cx="256" cy="244" rx="68" ry="10" fill="#8B3A0F"/>
  <!-- pan inferior hamburguesa -->
  <ellipse cx="256" cy="252" rx="65" ry="14" fill="#D4881A"/>

  <!-- Perro caliente debajo -->
  <!-- pan perro -->
  <ellipse cx="256" cy="285" rx="72" ry="16" fill="#D4881A"/>
  <!-- salchicha -->
  <ellipse cx="256" cy="282" rx="60" ry="10" fill="#CC3300"/>
  <!-- mostaza -->
  <path d="M 200 280 Q 230 275 256 280 Q 282 275 312 280"
    stroke="#FFD700" stroke-width="3" fill="none"/>
  <!-- pan inferior perro -->
  <ellipse cx="256" cy="293" rx="72" ry="12" fill="#C4781A"/>

  <!-- Líneas decorativas verdes (hojas) -->
  <line x1="100" y1="260" x2="145" y2="240"
    stroke="#00FF88" stroke-width="6" stroke-linecap="round"/>
  <line x1="100" y1="260" x2="130" y2="280"
    stroke="#00FF88" stroke-width="4" stroke-linecap="round"/>
  <line x1="412" y1="260" x2="367" y2="240"
    stroke="#00CC66" stroke-width="6" stroke-linecap="round"/>
  <line x1="412" y1="260" x2="382" y2="280"
    stroke="#00CC66" stroke-width="4" stroke-linecap="round"/>

  <!-- Cuchillo izquierdo -->
  <g transform="rotate(-35, 130, 310)">
    <rect x="126" y="270" width="8" height="70"
      rx="2" fill="#00CCFF"/>
    <rect x="124" y="265" width="12" height="10"
      rx="1" fill="#0099BB"/>
    <polygon points="126,265 134,265 130,245" fill="#00CCFF"/>
  </g>

  <!-- Tenedor izquierdo -->
  <g transform="rotate(-25, 108, 310)">
    <rect x="104" y="290" width="8" height="55"
      rx="2" fill="#00FFAA"/>
    <rect x="100" y="265" width="3" height="28"
      rx="1" fill="#00FFAA"/>
    <rect x="105" y="265" width="3" height="28"
      rx="1" fill="#00FFAA"/>
    <rect x="110" y="265" width="3" height="28"
      rx="1" fill="#00FFAA"/>
    <rect x="100" y="285" width="13" height="5"
      rx="1" fill="#00FFAA"/>
  </g>

  <!-- Cuchillo derecho -->
  <g transform="rotate(35, 382, 310)">
    <rect x="378" y="270" width="8" height="70"
      rx="2" fill="#FFD700"/>
    <rect x="376" y="265" width="12" height="10"
      rx="1" fill="#CCAA00"/>
    <polygon points="378,265 386,265 382,245" fill="#FFD700"/>
  </g>

  <!-- Tenedor derecho -->
  <g transform="rotate(25, 404, 310)">
    <rect x="400" y="290" width="8" height="55"
      rx="2" fill="#FF6600"/>
    <rect x="396" y="265" width="3" height="28"
      rx="1" fill="#FF6600"/>
    <rect x="401" y="265" width="3" height="28"
      rx="1" fill="#FF6600"/>
    <rect x="406" y="265" width="3" height="28"
      rx="1" fill="#FF6600"/>
    <rect x="396" y="285" width="13" height="5"
      rx="1" fill="#FF6600"/>
  </g>

  <!-- Texto FAST FOOD abajo -->
  <text x="256" y="415"
    font-family="Arial Black, sans-serif"
    font-size="36" font-weight="900"
    fill="#FFFFFF" stroke="#FF00AA" stroke-width="1"
    text-anchor="middle" letter-spacing="4">
    FAST FOOD
  </text>

  <!-- Borde exterior neón adicional -->
  <circle cx="256" cy="256" r="238"
    fill="none" stroke="#FF00FF" stroke-width="4"
    opacity="0.6"/>
</svg>`;

const outputDir = path.join(__dirname, '../public');

async function generarIconos() {
  const svgBuffer = Buffer.from(svg);

  const sizes = [
    { size: 512, name: 'pwa-512.png' },
    { size: 192, name: 'pwa-192.png' },
    { size: 180, name: 'apple-touch-icon.png' },
    { size: 32,  name: 'favicon-32x32.png' },
    { size: 16,  name: 'favicon-16x16.png' },
  ];

  for (const { size, name } of sizes) {
    await sharp(svgBuffer)
      .resize(size, size)
      .png()
      .toFile(path.join(outputDir, name));
    console.log(`✅ Generado: ${name} (${size}x${size})`);
  }

  console.log('\n✅ Todos los iconos generados en frontend/public/');
}

generarIconos().catch(console.error);
