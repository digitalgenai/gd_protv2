"""
Script de execução única: cria 1 usuário técnico placeholder ("Vendedor Padrão") para
satisfazer a constraint NOT NULL em propostas_contador_mensal_vendedor.vendedor_id —
sem essa linha, nenhuma proposta pode ser criada (o trigger fn_generate_codigo_base_proposta
grava nessa tabela toda vez). Sem login funcional — senha é só um placeholder via pgcrypto.
Rodar uma vez: `python seed_usuarios.py`.
"""
from sqlalchemy import text

from db import engine

EMAIL_PADRAO = "vendedor.padrao@galpaodesign.local"

SQL = """
INSERT INTO usuarios (nome, email, senha_hash, perfil, setor)
VALUES (:nome, :email, crypt(:senha, gen_salt('bf')), 'Vendedor', 'Vendas')
ON CONFLICT (email) DO NOTHING
RETURNING id, codigo_vendedor;
"""


def seed():
    with engine.begin() as conn:
        result = conn.execute(text(SQL), {
            "nome": "Vendedor Padrão",
            "email": EMAIL_PADRAO,
            "senha": "placeholder-sem-login-real",
        })
        row = result.fetchone()
        if row:
            print(f"Criado: id={row.id} codigo_vendedor={row.codigo_vendedor}")
        else:
            print(f"Já existia ({EMAIL_PADRAO}) — nada inserido.")


if __name__ == "__main__":
    seed()
