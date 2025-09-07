import os
from flask import Flask, request, jsonify
import requests

app = Flask(__name__)

GITHUB_TOKEN = os.environ.get("GITHUB_TOKEN")
GITHUB_API_URL = "https://api.github.com/repos/peleadeseguidores/peleadeseguidores-game-web/contents/images"

@app.route('/api/avatar', methods=['POST'])
def subir_avatar():
    data = request.get_json()
    nombre = data.get('nombre', '').strip()
    base64img = data.get('base64')
    mimetype = data.get('mimetype', 'image/png')

    if not nombre or not base64img:
        return jsonify({"error": "Nombre y base64 requeridos"}), 400

    # Limpia nombre para archivo
    clean = nombre.replace('@','').replace(' ','_').replace('/','_')
    ext = 'png' if mimetype == 'image/png' else 'jpg'
    filename = f"{clean}.{ext}"

    github_url = f"{GITHUB_API_URL}/{filename}"
    body = {
        "message": f"Avatar de {nombre} agregado automáticamente",
        "content": base64img
    }

    # Verifica si ya existe para obtener SHA
    r = requests.get(github_url, headers={"Authorization": f"token {GITHUB_TOKEN}"})
    if r.status_code == 200:
        sha = r.json().get("sha")
        body["sha"] = sha

    # Subir avatar
    resp = requests.put(
        github_url,
        headers={
            "Authorization": f"token {GITHUB_TOKEN}",
            "Content-Type": "application/json",
            "Accept": "application/vnd.github.v3+json"
        },
        json=body
    )
    if resp.status_code in [200,201]:
        return jsonify(resp.json())
    return jsonify({"error": resp.text}), resp.status_code

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=10000)
