package mergerequest

// ProviderType identifies the git provider
type ProviderType string

const (
	ProviderGitLab ProviderType = "gitlab"
	ProviderGitHub ProviderType = "github"
)

// CreateParams contains all data needed to create a MR/PR
type CreateParams struct {
	Token        string // Plaintext access token
	BaseURL      string // Provider base URL (e.g., https://gitlab.com)
	ProjectID    string // GitLab: numeric ID or path, GitHub: owner/repo
	Title        string
	Description  string
	SourceBranch string // Branch with changes
	TargetBranch string // Branch to merge into (e.g., main)
}

// Result contains the created MR/PR info
type Result struct {
	URL    string // Web URL to the MR/PR
	Number int    // MR IID (GitLab) or PR number (GitHub)
	ID     string // Internal ID
}

// Creator creates merge requests/pull requests
type Creator interface {
	// Create creates a new MR/PR and returns the result
	Create(params CreateParams) (*Result, error)
}
