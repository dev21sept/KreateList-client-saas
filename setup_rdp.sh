#!/bin/bash
# ==============================================================================
#                      GUI & REMOTE DESKTOP (RDP) SETUP SCRIPT
# ==============================================================================
# Installs XFCE (lightweight GUI) and XRDP on Ubuntu, then configures users
# 'ubuntu' and 'dpatidar200214' with password '1234'.
# ==============================================================================

# Exit immediately if a command exits with a non-zero status
set -e

echo "=== 1. Updating packages ==="
sudo apt update -y

echo "=== 2. Installing XFCE Desktop Environment ==="
# Installing xfce4 is lightweight and performs much better over remote desktop
sudo apt install -y xfce4 xfce4-goodies

echo "=== 3. Installing XRDP Server ==="
sudo apt install -y xrdp

echo "=== 4. Creating and Configuring User: dpatidar200214 ==="
# Check if user exists, if not create
if ! id -u dpatidar200214 >/dev/null 2>&1; then
    sudo useradd -m -s /bin/bash dpatidar200214
    echo "User dpatidar200214 created."
else
    echo "User dpatidar200214 already exists."
fi

# Set password to 1234 for dpatidar200214
echo "dpatidar200214:1234" | sudo chpasswd
# Add to sudo group
sudo usermod -aG sudo dpatidar200214
echo "User dpatidar200214 added to sudo group and password set to 1234."

# Configure XRDP session to launch XFCE for dpatidar200214
echo "xfce4-session" | sudo tee /home/dpatidar200214/.xsession > /dev/null
sudo chown dpatidar200214:dpatidar200214 /home/dpatidar200214/.xsession

echo "=== 5. Configuring User: ubuntu ==="
# Only set up ubuntu user if it exists on the system
if id -u ubuntu >/dev/null 2>&1; then
    echo "ubuntu:1234" | sudo chpasswd
    echo "User ubuntu password set to 1234."
    if [ -d /home/ubuntu ]; then
        echo "xfce4-session" | sudo tee /home/ubuntu/.xsession > /dev/null
        sudo chown ubuntu:ubuntu /home/ubuntu/.xsession
    fi
else
    echo "User 'ubuntu' does not exist on this machine. Skipping."
fi

echo "=== 6. Configuring XRDP Settings ==="
# Allow any user to start X server
if [ -f /etc/xrdp/Xwrapper.config ]; then
    sudo sed -i 's/allowed_users=console/allowed_users=anybody/g' /etc/xrdp/Xwrapper.config
fi

# Enable and start XRDP service
sudo systemctl enable xrdp
sudo systemctl restart xrdp

# Add xrdp to ssl-cert group to avoid authorization prompts
sudo adduser xrdp ssl-cert

echo "=== 7. Configuring UFW Firewall ==="
if command -v ufw >/dev/null; then
    sudo ufw allow 3389/tcp
    echo "Firewall port 3389 allowed in local UFW."
fi

echo "============================================================"
echo " SETUP COMPLETE! "
echo "============================================================"
echo "Next Steps:"
echo "1. Connect using Windows Remote Desktop Connection (mstsc.exe)."
echo "2. Host / Computer: [Server Public IP]"
echo "3. Try logging in with:"
echo "   - Username: dpatidar200214"
echo "   - Password: 1234"
echo "============================================================"
