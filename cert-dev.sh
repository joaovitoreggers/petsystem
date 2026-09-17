#!/usr/bin/env bash
# Gera o certificado de desenvolvimento usado para abrir o app no celular.
#
# Por que isso existe: o reconhecimento facial depende da câmera, e navegador
# nenhum entrega câmera fora de um contexto seguro — só em HTTPS ou em
# localhost. Aberto pelo IP da rede em http://, `navigator.mediaDevices` nem
# existe, e a tela só consegue dizer que a câmera está indisponível.
#
# O certificado é autoassinado: o aparelho vai avisar que não conhece quem
# emitiu, e o aviso está certo — ninguém emitiu. Serve para testar na sua
# rede, nunca para colocar na internet.
#
# Uso:
#   ./cert-dev.sh                 usa o IP da máquina na rede local
#   ./cert-dev.sh 192.168.0.42    usa o IP informado
set -euo pipefail
cd "$(dirname "$0")"

IP="${1:-}"
if [ -z "$IP" ]; then
  # Descobre o IP da rede local sem depender de ferramenta específica.
  #
  # Só aceita faixa privada (192.168.x, 10.x, 172.16–31.x): numa máquina com
  # VPN instalada, o primeiro endereço da lista costuma ser o da VPN — e um
  # certificado emitido para ele não serve para o celular que está no Wi-Fi
  # de casa.
  TODOS="$(
    (ipconfig 2>/dev/null || ip -4 addr 2>/dev/null || ifconfig 2>/dev/null) |
      grep -oE '([0-9]{1,3}\.){3}[0-9]{1,3}' |
      grep -vE '^(127\.|169\.254\.|255\.|0\.)'
  )"
  IP="$(echo "$TODOS" | grep -E '^(192\.168\.|10\.|172\.(1[6-9]|2[0-9]|3[01])\.)' | head -n 1)"
fi

if [ -z "$IP" ]; then
  echo "Não consegui descobrir o IP da rede. Passe como argumento:" >&2
  echo "  ./cert-dev.sh 192.168.0.42" >&2
  exit 1
fi

mkdir -p .certs
cat > .certs/openssl.cnf <<CNF
[req]
distinguished_name = dn
x509_extensions = v3
prompt = no

[dn]
CN = PET Digital (desenvolvimento)

[v3]
subjectAltName = @alt
basicConstraints = critical, CA:FALSE
keyUsage = critical, digitalSignature, keyEncipherment
extendedKeyUsage = serverAuth

[alt]
DNS.1 = localhost
IP.1 = 127.0.0.1
IP.2 = ${IP}
CNF

openssl req -x509 -nodes -newkey rsa:2048 -days 365 \
  -keyout .certs/dev.key -out .certs/dev.crt -config .certs/openssl.cnf 2>/dev/null

cat <<EOF

Certificado gerado para ${IP} (vale 365 dias).

Suba o app com HTTPS:
  npx nx serve frontend --host=0.0.0.0 --port=4200 \\
    --ssl --ssl-cert=.certs/dev.crt --ssl-key=.certs/dev.key

E abra no celular (mesmo Wi-Fi):
  https://${IP}:4200

O aparelho vai avisar que a conexão não é privada — é o certificado
autoassinado. Aceite ("Mostrar detalhes" › "Visitar este site") e a câmera
passa a funcionar.
EOF
