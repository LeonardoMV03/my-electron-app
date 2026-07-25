const information = document.getElementById('info')

information.innerText = `Esta aplicación está usando Chrome (v${versions.chrome()}), Node.js (v${versions.node()}), and Electron (v${versions.electron()})`;