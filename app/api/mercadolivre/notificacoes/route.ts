/*
  Endereco de notificacoes do Mercado Livre (campo "URL de retorno de
  notificacoes" da aplicacao). O ML chama aqui quando um topico escolhido muda
  (pedido, envio, anuncio) e exige resposta 200 rapida, senao reenvia e pode
  desligar o envio. Por enquanto so confirma o recebimento: os pedidos entram
  pela tela de importar. Quando houver busca automatica, e daqui que ela parte.
  Rota estatica: tem prioridade sobre app/api/mercadolivre/[acao] e nao exige login.
*/

export async function POST() {
  return Response.json({ ok: true });
}

export async function GET() {
  return Response.json({ ok: true });
}
