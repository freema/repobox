package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"encoding/base64"
	"encoding/hex"
	"errors"
	"fmt"
	"strings"
)

const (
	ivLength      = 12 // 96 bits for GCM
	authTagLength = 16 // 128 bits
)

// Decryptor handles AES-256-GCM decryption
type Decryptor struct {
	key []byte
}

// NewDecryptor creates a new decryptor from the encryption key.
// Key can be: 64 hex chars, 44 base64 chars, or 32 raw bytes.
func NewDecryptor(keyStr string) (*Decryptor, error) {
	key, err := parseKey(keyStr)
	if err != nil {
		return nil, err
	}
	return &Decryptor{key: key}, nil
}

// Decrypt decrypts data encrypted by the web app.
// Format: iv:authTag:ciphertext (all base64 encoded)
func (d *Decryptor) Decrypt(encryptedData string) (string, error) {
	parts := strings.Split(encryptedData, ":")
	if len(parts) != 3 {
		return "", errors.New("invalid encrypted data format: expected iv:authTag:ciphertext")
	}

	iv, err := base64.StdEncoding.DecodeString(parts[0])
	if err != nil {
		return "", fmt.Errorf("failed to decode IV: %w", err)
	}
	if len(iv) != ivLength {
		return "", fmt.Errorf("invalid IV length: expected %d, got %d", ivLength, len(iv))
	}

	authTag, err := base64.StdEncoding.DecodeString(parts[1])
	if err != nil {
		return "", fmt.Errorf("failed to decode auth tag: %w", err)
	}
	if len(authTag) != authTagLength {
		return "", fmt.Errorf("invalid auth tag length: expected %d, got %d", authTagLength, len(authTag))
	}

	ciphertext, err := base64.StdEncoding.DecodeString(parts[2])
	if err != nil {
		return "", fmt.Errorf("failed to decode ciphertext: %w", err)
	}

	block, err := aes.NewCipher(d.key)
	if err != nil {
		return "", fmt.Errorf("failed to create cipher: %w", err)
	}

	gcm, err := cipher.NewGCMWithNonceSize(block, ivLength)
	if err != nil {
		return "", fmt.Errorf("failed to create GCM: %w", err)
	}

	// GCM expects ciphertext + authTag concatenated
	ciphertextWithTag := append(ciphertext, authTag...)

	plaintext, err := gcm.Open(nil, iv, ciphertextWithTag, nil)
	if err != nil {
		return "", fmt.Errorf("decryption failed: %w", err)
	}

	return string(plaintext), nil
}

// parseKey parses the encryption key from various formats
func parseKey(keyStr string) ([]byte, error) {
	// Hex-encoded (64 chars = 32 bytes)
	if len(keyStr) == 64 && isHex(keyStr) {
		return hex.DecodeString(keyStr)
	}

	// Base64-encoded (44 chars with padding)
	if len(keyStr) == 44 && isBase64(keyStr) {
		decoded, err := base64.StdEncoding.DecodeString(keyStr)
		if err == nil && len(decoded) == 32 {
			return decoded, nil
		}
	}

	// Raw 32-byte string
	if len(keyStr) == 32 {
		return []byte(keyStr), nil
	}

	return nil, errors.New("ENCRYPTION_KEY must be 32 bytes: 64 hex chars, 44 base64 chars, or 32 raw chars")
}

func isHex(s string) bool {
	for _, c := range s {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f') || (c >= 'A' && c <= 'F')) {
			return false
		}
	}
	return true
}

func isBase64(s string) bool {
	for _, c := range s {
		if !((c >= 'A' && c <= 'Z') || (c >= 'a' && c <= 'z') || (c >= '0' && c <= '9') || c == '+' || c == '/' || c == '=') {
			return false
		}
	}
	return true
}
