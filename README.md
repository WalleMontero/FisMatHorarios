# FisMat Horarios

Visualizador de horarios **100% estático**. Permite seleccionar secciones, ver el calendario en tiempo real y personalizar colores y tema visual.

## Qué es este proyecto

Una interfaz web ligera para explorar materias y construir un horario visual sin backend. Carga un los datos desde un unico JSON, renderiza el calendario y guarda tus preferencias localmente usando cookies.

## Funcionalidades principales

- **Selección de secciones** con búsqueda por nombre, clave o área.
- **Calendario interactivo** con tarjetas por día y sección.
- **Panel de seleccionadas** con cambios de color por materia.
- **Modal de detalles** por sección (profesor, horarios, etc.).
- **Modo claro/oscuro** con un solo botón.
- **Persistencia local** en `localStorage` (no hay cuentas ni servidor).
- **Sincronización con Google Calendar** (no verificada por Google, pero funciona).

## Estructura del proyecto

- `index.html` — UI principal y layout.
- `assets/css/` — estilos (base, layout, componentes, calendario, modales).
- `assets/*.js` — lógica de UI, render de calendario, persistencia y sync.
- `data/merged_data.json` — datos fuente.

## Privacidad

No se envían datos a servidores. Las selecciones y colores se guardan localmente en el navegador usando `localStorage`.
