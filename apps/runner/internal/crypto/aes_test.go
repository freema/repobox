package crypto

import (
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"encoding/base64"
	"encoding/hex"
	"testing"
)

// Helper to encrypt data the same way the TypeScript app does
func encryptForTest(plaintext string, keyHex string) (string, error) {
	key, _ := hex.DecodeString(keyHex)

	iv := make([]byte, ivLength)
	if _, err := rand.Read(iv); err != nil {
		return "", err
	}

	block, err := aes.NewCipher(key)
	if err != nil {
		return "", err
	}

	gcm, err := cipher.NewGCMWithNonceSize(block, ivLength)
	if err != nil {
		return "", err
	}

	ciphertext := gcm.Seal(nil, iv, []byte(plaintext), nil)

	// Split ciphertext and auth tag
	authTag := ciphertext[len(ciphertext)-authTagLength:]
	ciphertextOnly := ciphertext[:len(ciphertext)-authTagLength]

	// Format: iv:authTag:ciphertext (base64)
	return base64.StdEncoding.EncodeToString(iv) + ":" +
		base64.StdEncoding.EncodeToString(authTag) + ":" +
		base64.StdEncoding.EncodeToString(ciphertextOnly), nil
}

func TestDecryptor_Decrypt(t *testing.T) {
	// Test key (32 bytes = 64 hex chars)
	keyHex := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"

	decryptor, err := NewDecryptor(keyHex)
	if err != nil {
		t.Fatalf("NewDecryptor failed: %v", err)
	}

	tests := []struct {
		name      string
		plaintext string
	}{
		{"simple token", "ghp_1234567890abcdefghijklmnopqrstuvwxyz"},
		{"short text", "test"},
		{"long text", "this is a much longer piece of text that should also work correctly"},
		{"special chars", "token-with-special_chars.and/slashes"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			// Encrypt
			encrypted, err := encryptForTest(tt.plaintext, keyHex)
			if err != nil {
				t.Fatalf("encryptForTest failed: %v", err)
			}

			// Decrypt
			decrypted, err := decryptor.Decrypt(encrypted)
			if err != nil {
				t.Fatalf("Decrypt failed: %v", err)
			}

			if decrypted != tt.plaintext {
				t.Errorf("Decrypt() = %q, want %q", decrypted, tt.plaintext)
			}
		})
	}
}

func TestDecryptor_InvalidFormat(t *testing.T) {
	keyHex := "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef"
	decryptor, _ := NewDecryptor(keyHex)

	tests := []struct {
		name      string
		encrypted string
		wantErr   string
	}{
		{"no colons", "invaliddata", "invalid encrypted data format"},
		{"one colon", "part1:part2", "invalid encrypted data format"},
		{"invalid base64 iv", "!!!:AAAA:AAAA", "failed to decode IV"},
		{"invalid base64 tag", "AAAA:!!!:AAAA", "failed to decode auth tag"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := decryptor.Decrypt(tt.encrypted)
			if err == nil {
				t.Error("expected error, got nil")
			}
		})
	}
}

func TestNewDecryptor_KeyFormats(t *testing.T) {
	tests := []struct {
		name    string
		key     string
		wantErr bool
	}{
		{"valid hex 64 chars", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef", false},
		{"valid raw 32 chars", "12345678901234567890123456789012", false},
		{"too short", "abc", true},
		{"too long hex", "0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef00", true},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := NewDecryptor(tt.key)
			if (err != nil) != tt.wantErr {
				t.Errorf("NewDecryptor() error = %v, wantErr %v", err, tt.wantErr)
			}
		})
	}
}
