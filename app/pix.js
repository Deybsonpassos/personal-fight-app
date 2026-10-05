// Personal Fight — Pix "copia e cola" (BR Code estático com valor, padrão EMV do Banco Central) + QR.
// Caminho 1: o QR aponta para a chave Pix do professor; o txid identifica a cobrança no extrato.
window.PF_PIX = (() => {
  const semAcento = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9 .@\-_]/g, "").toUpperCase();
  const tlv = (id, v) => id + String(v.length).padStart(2, "0") + v;
  function crc16(str) { let crc = 0xffff; for (let i = 0; i < str.length; i++) { crc ^= str.charCodeAt(i) << 8; for (let j = 0; j < 8; j++) crc = crc & 0x8000 ? ((crc << 1) ^ 0x1021) & 0xffff : (crc << 1) & 0xffff; } return crc.toString(16).toUpperCase().padStart(4, "0"); }
  // d = { chave, nome, cidade, valor_centavos, txid }
  function codigo(d) {
    const nome = semAcento(d.nome).slice(0, 25) || "PERSONAL FIGHT", cidade = semAcento(d.cidade).slice(0, 15) || "BELEM";
    const txid = String(d.txid || "***").replace(/[^A-Za-z0-9]/g, "").slice(0, 25) || "***";
    const valor = d.valor_centavos != null ? (d.valor_centavos / 100).toFixed(2) : null;
    let p = tlv("00", "01") + tlv("26", tlv("00", "br.gov.bcb.pix") + tlv("01", String(d.chave).trim())) + tlv("52", "0000") + tlv("53", "986");
    if (valor) p += tlv("54", valor);
    p += tlv("58", "BR") + tlv("59", nome) + tlv("60", cidade) + tlv("62", tlv("05", txid)) + "6304";
    return p + crc16(p);
  }
  // desenha o QR em SVG dentro do elemento (precisa de qrcode.js carregado)
  function svg(texto, tamanho = 220) {
    if (typeof qrcode !== "function") return `<div class="vazio">QR indisponível (biblioteca não carregou)</div>`;
    const q = qrcode(0, "M"); q.addData(texto); q.make();
    return q.createSvgTag({ cellSize: Math.max(2, Math.floor(tamanho / q.getModuleCount())), margin: 4, scalable: true });
  }
  return { codigo, svg, crc16 };
})();
