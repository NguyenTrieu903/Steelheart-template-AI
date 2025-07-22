// Example: Before and After Auto-Commenting

// BEFORE (Original Code):

```typescript
export const useAuth = () => {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const token = localStorage.getItem("token");
    if (token) {
      verifyToken(token).then((userData) => {
        setUser(userData);
        setLoading(false);
      });
    } else {
      setLoading(false);
    }
  }, []);

  const login = async (email, password) => {
    try {
      const response = await authAPI.login(email, password);
      localStorage.setItem("token", response.token);
      setUser(response.user);
      return { success: true };
    } catch (error) {
      return { success: false, error: error.message };
    }
  };

  return { user, loading, login };
};
```

// AFTER (Auto-Commented Code):

```typescript
/**
 * Custom hook for managing user authentication state and operations
 * Handles user login, token verification, and auth state persistence
 */
export const useAuth = () => {
  // Current authenticated user data, null if not logged in
  const [user, setUser] = useState(null);

  // Loading state for initial authentication check
  const [loading, setLoading] = useState(true);

  // Effect: Check for existing authentication token on mount
  useEffect(() => {
    // Retrieve stored authentication token from localStorage
    const token = localStorage.getItem("token");

    if (token) {
      // Verify token validity and get user data
      verifyToken(token).then((userData) => {
        setUser(userData);
        setLoading(false);
      });
    } else {
      // No token found, user is not authenticated
      setLoading(false);
    }
  }, []);

  /**
   * Authenticate user with email and password
   * @param {string} email - User's email address
   * @param {string} password - User's password
   * @returns {Promise<{success: boolean, error?: string}>} Login result
   */
  const login = async (email, password) => {
    try {
      // Call authentication API with credentials
      const response = await authAPI.login(email, password);

      // Store JWT token in localStorage for persistence
      localStorage.setItem("token", response.token);

      // Update user state with authenticated user data
      setUser(response.user);

      return { success: true };
    } catch (error) {
      // Return error details for UI feedback
      return { success: false, error: error.message };
    }
  };

  // Return authentication state and methods
  return { user, loading, login };
};
```

// Summary of Comments Added:
// ✅ Added JSDoc comment for the main hook function
// ✅ Explained state variables and their purpose
// ✅ Documented the useEffect logic for token verification
// ✅ Added JSDoc for the login function with parameters and return type
// ✅ Explained localStorage token storage strategy
// ✅ Clarified error handling approach
// ✅ Added inline comments for complex logic steps

// Total Comments Added: 12
// Comment Types: JSDoc (2), Inline (8), Block (2)
