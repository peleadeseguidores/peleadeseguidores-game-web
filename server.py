import os
import base64
import requests
from flask import Flask, request, jsonify

app = Flask(__name__)

GITHUB_TOKEN = os.environ.get('GITHUB_TOKEN')
GITHUB_REPO = "peleadeseguidores/peleadeseguidores-game-web"
IMAGES_PATH = "images"

def upload_image_to_github(image_bytes, filename, username):
    url = f"https://api.github.com/repos/{GITHUB_REPO}/contents/{IMAGES_PATH}/{username}_{filename}"
    headers = {
        "Authorization": f"Bearer {GITHUB_TOKEN}",
        "Accept": "application/vnd.github+json"
    }
    content = base64.b64encode(image_bytes).decode('utf-8')
    data = {
        "message": f"Subir imagen de {username}",
        "content": content
    }
    response = requests.put(url, headers=headers, json=data)
    return response

@app.route("/api/avatar", methods=["POST"])
def upload_avatar():
    data = request.get_json()
    if not data or "nombre" not in data or "base64" not in data or "mimetype" not in data:
        return jsonify({"error": "Datos insuficientes"}), 400

    nombre = data["nombre"].strip().replace("@", "").replace(" ", "_")
    base64_img = data["base64"]
    mimetype = data["mimetype"]

    ext = {
        "image/png": ".png",
        "image/jpeg": ".jpg",
        "image/jpg": ".jpg"
    }.get(mimetype, ".png")

    filename = f"{nombre}{ext}"
    try:
        image_bytes = base64.b64decode(base64_img)
    except Exception as e:
        return jsonify({"error": "La imagen no es válida"}), 400

    response = upload_image_to_github(image_bytes, filename, nombre)
    if response.status_code in [201, 200]:
        data_resp = response.json()
        image_url = data_resp.get("content", {}).get("download_url", "")
        return jsonify({
            "message": "Imagen subida correctamente",
            "url": image_url,
            "name": nombre
        }), 200
    else:
        return jsonify({
            "error": "No se pudo subir la imagen",
            "details": response.json()
        }), 500

@app.route("/", methods=["GET"])
def home():
    return "API para subir nombre y foto a GitHub repo", 200

if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
