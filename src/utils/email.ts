/** Gera um link mailto: com assunto/corpo pré-preenchidos. Sem e-mail do cliente cadastrado,
 * o campo "Para" fica vazio e o vendedor escolhe o destinatário no próprio cliente de e-mail. */
export function buildMailtoShareLink(email: string | null | undefined, subject: string, body: string): string {
  const to = (email ?? '').trim();
  return `mailto:${to}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
}
