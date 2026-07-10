from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from config import UPLOADS_DIR
from db import engine
from routes.produtos import bp as produtos_bp
from routes.propostas import bp as propostas_bp


def create_app() -> Flask:
    app = Flask(__name__)
    CORS(app, resources={r"/*": {"origins": ["http://localhost:5173"]}})

    app.register_blueprint(produtos_bp)
    app.register_blueprint(propostas_bp)

    @app.get("/health")
    def health():
        """RF-051 — sem autenticação."""
        try:
            engine.connect().close()
            db_ok = True
        except Exception:
            db_ok = False
        return jsonify({"status": "ok" if db_ok else "degraded", "database": db_ok})

    @app.get("/images/<codigo>/<path:filename>")
    def serve_uploaded_image(codigo, filename):
        """Serve imagens salvas em disco local (ver utils/image_storage.py). Só existe
        pra imagens novas enquanto não há credenciais S3 — as 290 imagens já
        cadastradas usam URL direta do S3 e nunca passam por aqui."""
        return send_from_directory(UPLOADS_DIR / codigo, filename)

    @app.errorhandler(404)
    def not_found(_err):
        return jsonify({"error": "Não encontrado."}), 404

    return app


app = create_app()

if __name__ == "__main__":
    app.run(port=5000, debug=True)
