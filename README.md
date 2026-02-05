# FisMat Horarios

Visualizador de horarios **100% estático** para desplegar en **GitHub Pages**.

## Qué hace

- Lista materias/secciones a partir de los datos.
- Permite seleccionar **secciones** (checkbox).
- Muestra en el calendario los horarios de las secciones seleccionadas.
- Guarda tu selección en `localStorage` para que no se pierda al recargar.

## Datos

El **único** archivo fuente de datos es:

- `FastWeb/data/merged_data.json`

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
