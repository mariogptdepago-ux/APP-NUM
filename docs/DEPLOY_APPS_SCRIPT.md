# Despliegue de Google Apps Script + Google Sheets

## 1. Crear Google Sheet maestro

Crea una hoja de cálculo en Google Drive llamada:

```text
PabloVI_App_Master
```

Crea las pestañas:

```text
Usuarios
Progreso
Intentos
Certificados
Eventos
PreguntasQuemadas
ErroresFrecuentes
Auditoria
```

También puedes usar la plantilla `superusuario_template.xlsx` incluida y subirla a Google Drive.

## 2. Crear Apps Script

1. En el Google Sheet, ve a **Extensiones > Apps Script**.
2. Copia el contenido de `apps_script/Code.gs`.
3. En propiedades del proyecto agrega:

```text
SPREADSHEET_ID = ID_DEL_GOOGLE_SHEET
SECRET_KEY = una_clave_larga_y_privada
```

El `SPREADSHEET_ID` está en la URL del Sheet.

## 3. Ejecutar configuración

En Apps Script, ejecuta manualmente:

```text
setupSpreadsheet()
seedDemoUsers()
```

Autoriza los permisos.

## 4. Desplegar como Web App

1. Clic en **Deploy > New deployment**.
2. Tipo: **Web app**.
3. Execute as: **Me**.
4. Who has access: **Anyone** o **Anyone with the link**.
5. Copia la URL generada.

## 5. Configurar la app

Edita `src/config.js`:

```js
window.PVI_CONFIG.APPS_SCRIPT_URL = "URL_DE_TU_WEB_APP";
```

Súbelo de nuevo a GitHub.
