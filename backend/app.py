from flask import Flask, jsonify, send_from_directory
from flask_cors import CORS

from config import CORS_ALLOWED_ORIGINS, SECRET_KEY, UPLOADS_DIR
from db import engine
from routes.auth import bp as auth_bp
from routes.catalogo_qualidade import bp as catalogo_qualidade_bp
from routes.dashboard import bp as dashboard_bp
from routes.produtos import bp as produtos_bp
from routes.propostas import bp as propostas_bp
from routes.usuarios import bp as usuarios_bp
from routes.voz import bp as voz_bp


def create_app() -> Flask:
    app = Flask(__name__)
    app.secret_key = SECRET_KEY
    # SameSite=Lax + HttpOnly: cookie de sessão não é lido por JS (mitiga XSS) e só viaja em
    # requests same-site (localhost:5173 e :5000 contam como same-site, portas diferentes não
    # importam pra essa checagem) — navegação cross-site de terceiros não carrega o cookie.
    app.config.update(
        SESSION_COOKIE_HTTPONLY=True,
        SESSION_COOKIE_SAMESITE="Lax",
        SESSION_COOKIE_SECURE=False,  # dev local em http — true obrigatório atrás de https em produção
    )
    CORS(app, resources={r"/*": {"origins": CORS_ALLOWED_ORIGINS}}, supports_credentials=True)

    app.register_blueprint(produtos_bp)
    app.register_blueprint(propostas_bp)
    app.register_blueprint(dashboard_bp)
    app.register_blueprint(catalogo_qualidade_bp)
    app.register_blueprint(voz_bp)
    app.register_blueprint(usuarios_bp)
    app.register_blueprint(auth_bp)

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
