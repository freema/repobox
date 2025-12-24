package util

// SafePrefix returns the first n characters of a string, or the whole string if shorter.
// This prevents panic from slice bounds out of range.
func SafePrefix(s string, n int) string {
	if len(s) < n {
		return s
	}
	return s[:n]
}
