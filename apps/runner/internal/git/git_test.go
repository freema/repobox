package git

import "testing"

func TestEmbedToken(t *testing.T) {
	tests := []struct {
		name    string
		repoURL string
		token   string
		want    string
		wantErr bool
	}{
		{
			name:    "github https",
			repoURL: "https://github.com/user/repo.git",
			token:   "ghp_xxxxxxxxxxxx",
			want:    "https://oauth2:ghp_xxxxxxxxxxxx@github.com/user/repo.git",
			wantErr: false,
		},
		{
			name:    "gitlab https",
			repoURL: "https://gitlab.com/user/repo.git",
			token:   "glpat-xxxxxxxxxxxx",
			want:    "https://oauth2:glpat-xxxxxxxxxxxx@gitlab.com/user/repo.git",
			wantErr: false,
		},
		{
			name:    "self-hosted gitlab",
			repoURL: "https://git.company.com/group/project.git",
			token:   "token123",
			want:    "https://oauth2:token123@git.company.com/group/project.git",
			wantErr: false,
		},
		{
			name:    "ssh url rejected",
			repoURL: "git@github.com:user/repo.git",
			token:   "token",
			want:    "",
			wantErr: true,
		},
		{
			name:    "http rejected",
			repoURL: "http://github.com/user/repo.git",
			token:   "token",
			want:    "",
			wantErr: true,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			got, err := embedToken(tt.repoURL, tt.token)
			if (err != nil) != tt.wantErr {
				t.Errorf("embedToken() error = %v, wantErr %v", err, tt.wantErr)
				return
			}
			if got != tt.want {
				t.Errorf("embedToken() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestMaskToken(t *testing.T) {
	tests := []struct {
		name  string
		token string
		want  string
	}{
		{
			name:  "github token",
			token: "ghp_1234567890abcdefghijklmnop",
			want:  "ghp_****mnop",
		},
		{
			name:  "gitlab token",
			token: "glpat-xxxxxxxxxxxxxxxxxxxx",
			want:  "glpa****xxxx",
		},
		{
			name:  "short token",
			token: "short",
			want:  "****",
		},
		{
			name:  "exactly 12 chars",
			token: "123456789012",
			want:  "****",
		},
		{
			name:  "13 chars",
			token: "1234567890123",
			want:  "1234****0123",
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := MaskToken(tt.token); got != tt.want {
				t.Errorf("MaskToken() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestMaskTokenInString(t *testing.T) {
	token := "ghp_secret1234567890token"
	masked := MaskToken(token)

	tests := []struct {
		name  string
		input string
		want  string
	}{
		{
			name:  "token in error message",
			input: "failed to clone: authentication failed for https://oauth2:ghp_secret1234567890token@github.com/user/repo.git",
			want:  "failed to clone: authentication failed for https://oauth2:" + masked + "@github.com/user/repo.git",
		},
		{
			name:  "no token",
			input: "some other error message",
			want:  "some other error message",
		},
		{
			name:  "multiple occurrences",
			input: "token: ghp_secret1234567890token and again: ghp_secret1234567890token",
			want:  "token: " + masked + " and again: " + masked,
		},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			if got := maskTokenInString(tt.input, token); got != tt.want {
				t.Errorf("maskTokenInString() = %v, want %v", got, tt.want)
			}
		})
	}
}

func TestMaskTokenInString_EmptyToken(t *testing.T) {
	input := "some message"
	got := maskTokenInString(input, "")
	if got != input {
		t.Errorf("maskTokenInString with empty token should return original string")
	}
}
