# Gramáticas Urbanas de Rosario

Plataforma web para el archivo situado y georreferenciado de expresiones gráficas urbanas de Rosario.

## Archivos vinculados

- Google Sheet: `112qgSxqPICtE_SXclRi541ZxjQEoCu1NLH_sJCX3JPM`
- Carpeta de fotografías en Google Drive: `1aaYp5SyldfaTUgNsfv3uYbhMSeGzrWNd`
- Hoja principal esperada: `art_collect`
- Hoja de actuaciones: `actuaciones`
- Hoja de usuarios: `usuarios`

## Categorías

Murales · Grafitis · Tags · Posters / Afiches · Stencils

## Instalación

1. Abra el Google Sheet indicado y cree/abra un proyecto de **Google Apps Script** asociado.
2. Pegue el contenido de `Codigo_Gramaticas_Urbanas.gs` en el editor de Apps Script.
3. Implemente como **Aplicación web**, ejecutando con la cuenta propietaria y habilitando el acceso necesario para el frontend.
4. Copie la URL terminada en `/exec` de la implementación.
5. En `index.html`, reemplace `PEGAR_AQUI_URL_WEB_APP_DE_APPS_SCRIPT` por esa URL.
6. Verifique que la cuenta que ejecuta Apps Script tenga permiso de edición sobre el Sheet y la carpeta de Drive.
7. Suba todo este directorio a un repositorio de GitHub y active **Settings → Pages → Deploy from a branch** sobre la rama principal y `/ (root)`.

## Usuario administrador

La plataforma conserva el esquema de accesos de Plataforma_LAINEZ. Para habilitar el primer administrador, agregue una fila en `usuarios` con:

- `USUARIO`: el nombre de usuario elegido.
- `CLAVE`: una contraseña inicial.
- `TIPO_ACCESO_OTORGADO`: `ADMIN`.

Las nuevas solicitudes se registran desde la plataforma y quedan sin rol asignado hasta que un ADMIN las habilite.

## Estados y mapa público

- `Aprobado`: visible en el mapa público con el color de su categoría.
- `Pendiente`: visible en el mapa público en gris.
- `Rechazado`: no se incorpora al mapa público.

## Estructura de datos

La plataforma usa las columnas existentes de `art_collect`:

`ID, CREADO_EN, ACTUALIZADO_EN, CATEGORIA, LAT, LNG, DIRECCION, PROVINCIA, DEPARTAMENTO, LOCALIDAD, COMENTARIO, FOTO_URL, USUARIO, ESTADO`.

`COMENTARIO` funciona como descripción general del registro.
