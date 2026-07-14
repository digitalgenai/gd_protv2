/** Gera o link de "click-to-chat" do WhatsApp. Sem telefone, cai no picker de contatos do
 * api.whatsapp.com; com telefone, assume DDI 55 quando o número informado não tiver DDI. */
export function buildWhatsAppShareLink(phone: string | null | undefined, message: string): string {
  const encoded = encodeURIComponent(message);
  const digits = (phone ?? '').replace(/\D/g, '');
  if (!digits) return `https://api.whatsapp.com/send?text=${encoded}`;
  const withCountryCode = digits.length <= 11 ? `55${digits}` : digits;
  return `https://wa.me/${withCountryCode}?text=${encoded}`;
}
