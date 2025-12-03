package mergerequest

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"
)

// GitHubClient creates pull requests on GitHub
type GitHubClient struct {
	httpClient *http.Client
}

// NewGitHubClient creates a new GitHub PR client
func NewGitHubClient() *GitHubClient {
	return &GitHubClient{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

type githubPRRequest struct {
	Title string `json:"title"`
	Body  string `json:"body"`
	Head  string `json:"head"` // Source branch
	Base  string `json:"base"` // Target branch
}

type githubPRResponse struct {
	ID      int    `json:"id"`
	Number  int    `json:"number"`
	HTMLURL string `json:"html_url"`
}

type githubError struct {
	Message string `json:"message"`
	Errors  []struct {
		Message string `json:"message"`
	} `json:"errors"`
}

// Create creates a pull request on GitHub
func (c *GitHubClient) Create(params CreateParams) (*Result, error) {
	apiURL := c.getAPIURL(params.BaseURL, params.ProjectID)

	reqBody := githubPRRequest{
		Title: params.Title,
		Body:  params.Description,
		Head:  params.SourceBranch,
		Base:  params.TargetBranch,
	}

	bodyBytes, err := json.Marshal(reqBody)
	if err != nil {
		return nil, fmt.Errorf("failed to marshal request: %w", err)
	}

	req, err := http.NewRequest(http.MethodPost, apiURL, bytes.NewReader(bodyBytes))
	if err != nil {
		return nil, fmt.Errorf("failed to create request: %w", err)
	}

	req.Header.Set("Content-Type", "application/json")
	req.Header.Set("Accept", "application/vnd.github+json")
	req.Header.Set("Authorization", fmt.Sprintf("Bearer %s", params.Token))
	req.Header.Set("X-GitHub-Api-Version", "2022-11-28")

	resp, err := c.httpClient.Do(req)
	if err != nil {
		return nil, fmt.Errorf("request failed: %w", err)
	}
	defer resp.Body.Close()

	respBody, err := io.ReadAll(resp.Body)
	if err != nil {
		return nil, fmt.Errorf("failed to read response: %w", err)
	}

	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		var errResp githubError
		_ = json.Unmarshal(respBody, &errResp)

		errMsg := errResp.Message
		if len(errResp.Errors) > 0 && errResp.Errors[0].Message != "" {
			errMsg = fmt.Sprintf("%s: %s", errMsg, errResp.Errors[0].Message)
		}
		if errMsg == "" {
			errMsg = string(respBody)
		}

		return nil, fmt.Errorf("GitHub API error (status %d): %s", resp.StatusCode, errMsg)
	}

	var prResp githubPRResponse
	if err := json.Unmarshal(respBody, &prResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &Result{
		URL:    prResp.HTMLURL,
		Number: prResp.Number,
		ID:     fmt.Sprintf("%d", prResp.ID),
	}, nil
}

// getAPIURL returns the API URL for creating PRs
// Handles both github.com and GitHub Enterprise
func (c *GitHubClient) getAPIURL(baseURL, projectID string) string {
	// projectID should be in format "owner/repo"
	if baseURL == "" || baseURL == "https://github.com" {
		return fmt.Sprintf("https://api.github.com/repos/%s/pulls", projectID)
	}

	// GitHub Enterprise uses /api/v3 suffix
	baseURL = strings.TrimSuffix(baseURL, "/")
	return fmt.Sprintf("%s/api/v3/repos/%s/pulls", baseURL, projectID)
}
