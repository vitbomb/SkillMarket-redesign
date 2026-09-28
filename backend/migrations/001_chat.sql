-- Skill Market - Chat interno
-- Execute este script uma única vez no SQL Editor do Neon.

CREATE TABLE IF NOT EXISTS conversas (
    id BIGSERIAL PRIMARY KEY,
    usuario_a_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    usuario_b_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    criada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    atualizada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    CONSTRAINT conversas_usuarios_diferentes CHECK (usuario_a_id < usuario_b_id),
    CONSTRAINT conversas_par_unico UNIQUE (usuario_a_id, usuario_b_id)
);

CREATE TABLE IF NOT EXISTS mensagens (
    id BIGSERIAL PRIMARY KEY,
    conversa_id BIGINT NOT NULL REFERENCES conversas(id) ON DELETE CASCADE,
    remetente_id INTEGER NOT NULL REFERENCES usuarios(id) ON DELETE CASCADE,
    conteudo TEXT NOT NULL,
    enviada_em TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    lida_em TIMESTAMPTZ,
    CONSTRAINT mensagens_conteudo_valido CHECK (
        char_length(btrim(conteudo)) BETWEEN 1 AND 2000
    )
);

CREATE INDEX IF NOT EXISTS idx_conversas_usuario_a
    ON conversas (usuario_a_id, atualizada_em DESC);

CREATE INDEX IF NOT EXISTS idx_conversas_usuario_b
    ON conversas (usuario_b_id, atualizada_em DESC);

CREATE INDEX IF NOT EXISTS idx_mensagens_conversa_id
    ON mensagens (conversa_id, id DESC);

CREATE INDEX IF NOT EXISTS idx_mensagens_nao_lidas
    ON mensagens (conversa_id, remetente_id)
    WHERE lida_em IS NULL;
