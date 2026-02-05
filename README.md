# FastWeb (GitHub Pages)

Visualizador de horarios **100% estático** (sin Flask). Permite:
- Seleccionar secciones de materias
- Visualizar los horarios seleccionados en el calendario

## Datos

El **único** archivo fuente de datos es `FastWeb/data/merged_data.py` (debe definir `MERGED_DATA = {...}`).

Estructura esperada (resumen):

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

Para que el navegador pueda leerlos, se genera `FastWeb/data/merged_data.json` con:

```bash
python3 FastWeb/tools/export_merged_data.py
```

## Probar local

Por restricciones del navegador, `fetch()` no funciona bien con `file://`. Usa un server local:

```bash
cd FastWeb
python3 -m http.server 8000
```

Luego abre `http://localhost:8000`.

## Publicar en GitHub Pages

GitHub Pages no permite elegir una carpeta arbitraria como raíz (solo `/` o `/docs` en “Deploy from branch”).

Opciones simples:
- Copiar el contenido de `FastWeb/` a `docs/` y configurar Pages para servir desde `/docs`.
- O publicar una rama/artefacto `gh-pages` que contenga **solo** el contenido de `FastWeb/`.
