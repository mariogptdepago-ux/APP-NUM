# Despliegue en GitHub Pages

1. Crea un repositorio en GitHub, por ejemplo `pablo-vi-math-app`.
2. Sube todos los archivos de esta carpeta.
3. En GitHub ve a **Settings > Pages**.
4. En **Build and deployment**, selecciona:
   - Source: `Deploy from a branch`
   - Branch: `main`
   - Folder: `/root`
5. Guarda.
6. GitHub generará una URL parecida a:

```text
https://usuario.github.io/pablo-vi-math-app/
```

7. Abre esa URL y prueba el login demo.
8. Cuando tengas Google Apps Script desplegado, edita `src/config.js` y pega la URL de la Web App.
