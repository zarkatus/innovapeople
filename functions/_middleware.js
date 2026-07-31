// O Jornada passou a viver dentro do site, em /jornada/. O subdominio antigo continua existindo
// porque ha links dele circulando (assinatura de e-mail, mensagem, indicacao) e link que quebra e
// conhecimento que se perde de novo.
//
// Aqui ele so redireciona, com 301, para o endereco novo:
//   jornada.innovapeople.com.br/                    -> innovapeople.com.br/jornada/
//   jornada.innovapeople.com.br/ensaios/clock-drift -> innovapeople.com.br/jornada/ensaios/clock-drift
//
// Qualquer outro host passa direto. A regra e deliberadamente estreita: um erro aqui afetaria o
// site inteiro, entao ela so age quando tem certeza de onde veio.
export async function onRequest(context) {
  const { request, next } = context;
  const url = new URL(request.url);

  if (url.hostname === 'jornada.innovapeople.com.br') {
    const destino = new URL(url.pathname === '/' ? '/jornada/' : '/jornada' + url.pathname,
                            'https://innovapeople.com.br');
    destino.search = url.search;
    return Response.redirect(destino.toString(), 301);
  }

  return next();
}
