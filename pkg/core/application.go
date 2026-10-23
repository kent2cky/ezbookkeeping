package core

import "fmt"

// ApplicationName represents the application name
const ApplicationName = "Smartcore Books"

// ApplicationIdentifier represents the application name without spaces, used in user agents and identifiers
const ApplicationIdentifier = "SmartcoreBooks"

// Version, CommitHash and BuildTime are set at build
var (
	Version    string
	CommitHash string
	BuildTime  string
)

func GetOutgoingUserAgent() string {
	if Version == "" {
		return ApplicationIdentifier
	}

	return fmt.Sprintf("%s/%s", ApplicationIdentifier, Version)
}
