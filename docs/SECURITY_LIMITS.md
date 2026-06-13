# Límites de seguridad en navegador

Una app web no puede impedir de forma absoluta:

- Cerrar el navegador.
- Cambiar de aplicación.
- Usar captura de pantalla del sistema operativo.
- Grabar pantalla desde otro dispositivo.

Este proyecto sí implementa medidas razonables:

- Solicitar pantalla completa.
- Detectar cambio de pestaña con Page Visibility API.
- Detectar pérdida de foco.
- Detectar salida de fullscreen.
- Registrar eventos sospechosos.
- Marcar como perdida la pregunta activa.
- Quemar el ítem y reemplazarlo por pregunta gemela.
- Guardar auditoría en el registro maestro.

La recomendación institucional es usar estas medidas como control formativo y no como sistema de evaluación de alta seguridad.
