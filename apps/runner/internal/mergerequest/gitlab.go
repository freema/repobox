package mergerequest

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"time"
)

// GitLabClient creates merge requests on GitLab
type GitLabClient struct {
	httpClient *http.Client
}

// NewGitLabClient creates a new GitLab MR client
func NewGitLabClient() *GitLabClient {
	return &GitLabClient{
		httpClient: &http.Client{
			Timeout: 30 * time.Second,
		},
	}
}

type gitlabMRRequest struct {
	SourceBranch string `json:"source_branch"`
	TargetBranch string `json:"target_branch"`
	Title        string `json:"title"`
	Description  string `json:"description"`
}

type gitlabMRResponse struct {
	ID     int    `json:"id"`
	IID    int    `json:"iid"`
	WebURL string `json:"web_url"`
}

type gitlabError struct {
	Message interface{} `json:"message"`
	Error   string      `json:"error"`
}

// Create creates a merge request on GitLab
func (c *GitLabClient) Create(params CreateParams) (*Result, error) {
	baseURL := params.BaseURL
	if baseURL == "" {
		baseURL = "https://gitlab.com"
	}

	// URL encode the project ID (could be numeric or path like "group/project")
	apiURL := fmt.Sprintf("%s/api/v4/projects/%s/merge_requests",
		baseURL,
		url.PathEscape(params.ProjectID),
	)

	reqBody := gitlabMRRequest{
		SourceBranch: params.SourceBranch,
		TargetBranch: params.TargetBranch,
		Title:        params.Title,
		Description:  params.Description,
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
	req.Header.Set("PRIVATE-TOKEN", params.Token)

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
		var errResp gitlabError
		_ = json.Unmarshal(respBody, &errResp)

		errMsg := errResp.Error
		if errMsg == "" {
			switch msg := errResp.Message.(type) {
			case string:
				errMsg = msg
			case []interface{}:
				if len(msg) > 0 {
					errMsg = fmt.Sprintf("%v", msg[0])
				}
			default:
				errMsg = string(respBody)
			}
		}

		return nil, fmt.Errorf("GitLab API error (status %d): %s", resp.StatusCode, errMsg)
	}

	var mrResp gitlabMRResponse
	if err := json.Unmarshal(respBody, &mrResp); err != nil {
		return nil, fmt.Errorf("failed to parse response: %w", err)
	}

	return &Result{
		URL:    mrResp.WebURL,
		Number: mrResp.IID,
		ID:     fmt.Sprintf("%d", mrResp.ID),
	}, nil
}
