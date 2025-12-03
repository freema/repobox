package mergerequest

import (
	"net/url"
	"strings"
)

// ExtractProjectID extracts the project identifier from a repository URL
//
// For GitHub: returns "owner/repo" (e.g., "microsoft/vscode")
// For GitLab: returns "group/project" path (e.g., "gitlab-org/gitlab")
//
// Handles various URL formats:
// - https://github.com/owner/repo
// - https://github.com/owner/repo.git
// - https://gitlab.com/group/subgroup/project.git
func ExtractProjectID(repoURL string) (string, error) {
	u, err := url.Parse(repoURL)
	if err != nil {
		return "", err
	}

	// Get path and clean it up
	path := strings.TrimPrefix(u.Path, "/")
	path = strings.TrimSuffix(path, ".git")
	path = strings.TrimSuffix(path, "/")

	return path, nil
}

// GetCreator returns the appropriate MR/PR creator for the provider type
func GetCreator(providerType ProviderType) Creator {
	switch providerType {
	case ProviderGitHub:
		return NewGitHubClient()
	case ProviderGitLab:
		return NewGitLabClient()
	default:
		return nil
	}
}
