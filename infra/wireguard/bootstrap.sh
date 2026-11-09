#!/usr/bin/env bash
# Bootstrap a Proxo VPN WireGuard node on Ubuntu/Debian 22.04+.
# Run as root on a fresh VPS.
set -euo pipefail

WG_INTERFACE="${WG_INTERFACE:-wg0}"
WG_PORT="${WG_PORT:-51820}"
WG_ADDRESS="${WG_ADDRESS:-10.8.0.1/24}"

if [[ "$(id -u)" -ne 0 ]]; then
  echo "Run as root: sudo bash bootstrap.sh"
  exit 1
fi

export DEBIAN_FRONTEND=noninteractive
apt-get update -y
apt-get install -y wireguard wireguard-tools iptables curl ca-certificates ufw

install -d -m 700 /etc/wireguard
if [[ ! -f /etc/wireguard/${WG_INTERFACE}.privatekey ]]; then
  umask 077
  wg genkey | tee /etc/wireguard/${WG_INTERFACE}.privatekey | wg pubkey > /etc/wireguard/${WG_INTERFACE}.publickey
fi

PRIVATE_KEY="$(cat /etc/wireguard/${WG_INTERFACE}.privatekey)"
PUBLIC_KEY="$(cat /etc/wireguard/${WG_INTERFACE}.publickey)"
DEFAULT_IFACE="$(ip route show default | awk '/default/ {print $5; exit}')"
PUBLIC_IP="$(curl -4 -s --max-time 8 https://ifconfig.me || curl -4 -s --max-time 8 https://api.ipify.org || true)"

if [[ -z "${DEFAULT_IFACE}" ]]; then
  echo "Could not detect default network interface"
  exit 1
fi

cat > "/etc/wireguard/${WG_INTERFACE}.conf" <<EOF
[Interface]
Address = ${WG_ADDRESS}
ListenPort = ${WG_PORT}
PrivateKey = ${PRIVATE_KEY}
SaveConfig = false
PostUp = sysctl -w net.ipv4.ip_forward=1; iptables -A FORWARD -i ${WG_INTERFACE} -j ACCEPT; iptables -A FORWARD -o ${WG_INTERFACE} -j ACCEPT; iptables -t nat -A POSTROUTING -o ${DEFAULT_IFACE} -j MASQUERADE
PostDown = iptables -D FORWARD -i ${WG_INTERFACE} -j ACCEPT; iptables -D FORWARD -o ${WG_INTERFACE} -j ACCEPT; iptables -t nat -D POSTROUTING -o ${DEFAULT_IFACE} -j MASQUERADE
EOF

chmod 600 "/etc/wireguard/${WG_INTERFACE}.conf"
systemctl enable --now "wg-quick@${WG_INTERFACE}"

# Persist IP forwarding
cat > /etc/sysctl.d/99-proxo-vpn.conf <<EOF
net.ipv4.ip_forward=1
EOF
sysctl --system >/dev/null

echo ""
echo "============================================"
echo " Proxo VPN WireGuard bootstrap complete"
echo "============================================"
echo " Interface:     ${WG_INTERFACE}"
echo " Listen port:   UDP ${WG_PORT}"
echo " Public IP:     ${PUBLIC_IP:-unknown}"
echo " Public key:    ${PUBLIC_KEY}"
echo " Default NIC:   ${DEFAULT_IFACE}"
echo ""
echo " Save the public key — you need it in the API server record."
echo " Next: bash firewall.sh && bash deploy-agent.sh"
echo "============================================"
