package session

// Status represents work session status
type Status string

const (
	StatusInitializing Status = "initializing"
	StatusReady        Status = "ready"
	StatusRunning      Status = "running"
	StatusPushed       Status = "pushed"
	StatusArchived     Status = "archived"
	StatusFailed       Status = "failed"
)

// Session represents a work session
type Session struct {
	ID               string
	UserID           string
	ProviderID       string
	RepoURL          string
	RepoName         string
	BaseBranch       string
	WorkBranch       string
	Status           Status
	MRUrl            string
	MRWarning        string
	ErrorMessage     string
	TotalLinesAdded  int
	TotalLinesRemoved int
	JobCount         int
	LastActivityAt   int64
	CreatedAt        int64
	PushedAt         int64
}

// InitMessage represents a session init task from the stream
type InitMessage struct {
	SessionID  string
	UserID     string
	ProviderID string
	RepoURL    string
	RepoName   string
	BaseBranch string
}

// JobMessage represents a session job task from the stream
type JobMessage struct {
	SessionID   string
	JobID       string
	UserID      string
	Prompt      string
	Environment string
}

// PushMessage represents a session push task from the stream
type PushMessage struct {
	SessionID   string
	UserID      string
	Title       string
	Description string
}
