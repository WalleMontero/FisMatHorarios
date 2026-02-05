# FisMat Horarios

Visualizador de horarios **100% estático** pensado para publicarse en **GitHub Pages**. Permite seleccionar secciones, ver el calendario en tiempo real y personalizar colores y tema visual.

## Qué es este proyecto

Una interfaz web ligera para explorar materias y construir un horario visual sin backend. Carga un único JSON, renderiza el calendario y guarda tus preferencias localmente.

## Funcionalidades principales

- **Selección de secciones** con búsqueda por nombre, clave o área.
- **Calendario interactivo** con tarjetas por día y sección.
- **Panel de seleccionadas** con cambios de color por materia.
- **Modal de detalles** por sección (profesor, horarios, etc.).
- **Modo claro/oscuro** con un solo botón.
- **Persistencia local** en `localStorage` (no hay cuentas ni servidor).
- **Sincronización con Google Calendar** (opcional).

## Cómo usarlo

1. Abre `index.html` en tu navegador o súbelo a GitHub Pages.
2. Busca materias y marca secciones.
3. Ajusta colores desde el panel de seleccionadas.
4. Cambia el tema desde el botón de la cabecera.

> Si usas GitHub Pages, asegúrate de que `data/merged_data.json` esté publicado junto al resto de archivos.

## Datos

El **único** archivo fuente de datos es:

- `data/merged_data.json`

### Estructura esperada (resumen)

```py
MERGED_DATA = {
  "Nombre de la materia": {
    "Clave": "…",
    "Area": "…",
    "Semestre": 3,
    "Secciones": {
      "01": {
        "Profesor": "…",
        "Actividades": {
          "1": {"Dia": "Lunes", "Horario": ["10:00", "12:00"], "Salon": "…"},
        },
      },
    },
  },
}
```

## Estructura del proyecto

- `index.html` — UI principal y layout.
- `assets/css/` — estilos (base, layout, componentes, calendario, modales).
- `assets/*.js` — lógica de UI, render de calendario, persistencia y sync.
- `data/merged_data.json` — datos fuente.

## Privacidad

No se envían datos a servidores. Las selecciones y colores se guardan localmente en el navegador usando `localStorage`.
