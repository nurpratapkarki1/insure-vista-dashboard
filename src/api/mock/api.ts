import { ApiResponse, Branch, PolicyHolder, SalesAgent, AgentReport, Customer, User, Company, Policy, GSVRate, SSVConfig, Loan, LoanRepayment } from '@/types';
import { AgentApplication } from '@/types';
import { API_URL, ENDPOINTS, API_TIMEOUT, API_ENDPOINTS } from '@/api/constants';

// Config - Use the imported constants
const apiUrl = API_URL;

// Disable mock data fallback for production use
const USE_MOCK_FALLBACK = false;

// Try different auth header formats if the default doesn't work
const tryDifferentAuthFormats = true;

// Helper to handle API responses
const handleResponse = async <T>(response: Response, endpoint: string): Promise<ApiResponse<T>> => {
  console.log('Response status:', response.status);
  try {
    const text = await response.text();
    console.log('Response text:', text.substring(0, 500)); // Log first 500 chars of response
    
    // Check if response is HTML instead of JSON (common error when API routes are wrong)
    if (text.trim().startsWith('<!DOCTYPE html>')) {
      console.error('API returned HTML instead of JSON. Check API endpoint URL.');
      throw new Error('Invalid API response format (received HTML)');
    }
    
    // Empty array but successful is fine
    if (text === '[]' && response.ok) {
      return {
        data: [] as any,
        status: response.status,
        message: "Success",
        success: true
      };
    }
    
    const data = text ? JSON.parse(text) : null;
    
    if (!response.ok) {
      return {
        data: null as any,
        status: response.status,
        message: data?.detail || data?.message || `Error: ${response.statusText}`,
        success: false
      };
    }

    return {
      data,
      status: response.status,
      message: "Success",
      success: true
    };
  } catch (error) {
    console.error('Error parsing response:', error);
    
    return {
      data: null as any,
      status: response.status || 0,
      message: `Error: ${(error as Error).message || response.statusText || 'Unknown error'}`,
      success: false
    };
  }
};

// Function to create a fetch request with timeout
const fetchWithTimeout = async (resource: string, options: RequestInit = {}, timeout = API_TIMEOUT): Promise<Response> => {
  const controller = new AbortController();
  const id = setTimeout(() => controller.abort(), timeout);
  
  const response = await fetch(resource, {
    ...options,
    signal: controller.signal,
  });
  
  clearTimeout(id);
  return response;
};

// Generic API request function with auth token
const apiRequest = async <T>(endpoint: string, options: RequestInit = {}): Promise<ApiResponse<T>> => {
    // Determine if this is a full URL or just an endpoint
    const fullUrl = endpoint.startsWith('http') ? endpoint : `${apiUrl}${endpoint}`;
    
    try {
      console.log(`API Request to: ${fullUrl}`);
      console.log(`Request method: ${options.method || 'GET'}`);
      
      // Log body based on type (don't stringify FormData)
      if (options.body) {
        if (options.body instanceof FormData) {
          console.log('Request payload: [FormData]');
        } else if (typeof options.body === 'string') {
          console.log('Request payload:', options.body);
        }
      }
      
      const token = localStorage.getItem('auth_token');
      const rawToken = localStorage.getItem('raw_auth_token');
      const authFormat = localStorage.getItem('auth_format') || 'bearer';
      
      console.log('Auth token exists:', !!token); 
      if (token) {
        console.log('Auth token (first 10 chars):', token.substring(0, 10) + '...');
      }
      console.log('Using auth format:', authFormat);
      
      // Use the format that was detected during login
      let authHeader = '';
      if (token) {
        if (authFormat === 'bearer') {
          authHeader = `Bearer ${token}`;
        } else if (authFormat === 'token') {
          authHeader = `Token ${token}`;
        } else if (authFormat === 'raw') {
          authHeader = rawToken || token;
        } else {
          authHeader = `Bearer ${token}`; // Default fallback
        }
      }
      
      // Don't add Content-Type for FormData requests
      const isFormData = options.body instanceof FormData;
      const headers = {
        ...(!isFormData && { 'Content-Type': 'application/json' }),
        ...(authHeader ? { 'Authorization': authHeader } : {}),
        ...options.headers,
      };
  
      const response = await fetchWithTimeout(fullUrl, {
        ...options,
        headers,
      });
  
      console.log(`API Response status: ${response.status}`);
      
      // If unauthorized and tryDifferentAuthFormats is enabled, try other formats
      if (response.status === 401 && tryDifferentAuthFormats && token) {
        console.log("Response was unauthorized. Trying alternative auth formats...");
        
        // Try formats in a different order than what we're currently using
        const formatsToTry = ['bearer', 'raw', 'token'].filter(f => f !== authFormat);
        
        for (const format of formatsToTry) {
          let alternativeHeader = '';
          
          if (format === 'bearer') {
            alternativeHeader = `Bearer ${token}`;
          } else if (format === 'token') {
            alternativeHeader = `Token ${token}`;
          } else if (format === 'raw') {
            alternativeHeader = rawToken || token;
          }
          
          console.log(`Trying ${format} format...`);
          
          try {
            const alternativeResponse = await fetch(fullUrl, {
              ...options,
              headers: {
                'Content-Type': 'application/json',
                'Authorization': alternativeHeader,
                ...options.headers,
              },
            });
            
            console.log(`${format} format response: ${alternativeResponse.status}`);
            
            if (alternativeResponse.status !== 401) {
              // This format worked! Save it for future requests
              localStorage.setItem('auth_format', format);
              console.log(`Saving working format: ${format}`);
              
              // Use this response
              return handleResponse<T>(alternativeResponse, endpoint);
            }
          } catch (e) {
            console.warn(`Error trying ${format} format:`, e);
          }
        }
      }
      
      return handleResponse<T>(response, endpoint);
    } catch (error) {
      console.error('API request failed:', error);
      
      return {
        data: null as any,
        status: 0,
        message: `Network error: ${(error as Error).message}`,
        success: false
      };
    }
  };


  // ======== BRANCH API ========
const handleBranchAPI = async (
  method: 'GET' | 'POST' | 'PUT' | 'DELETE',
  id?: number,
  data?: Branch | Omit<Branch, 'id'>
): Promise<ApiResponse<Branch[] | Branch | boolean>> => {
  switch (method) {
    case 'GET':
      return id 
        ? apiRequest<Branch>(`/branches/${id}/`) 
        : apiRequest<Branch[]>(`/branches/`);
        
    case 'POST':
      return apiRequest<Branch>(`/branches/`, {
        method: 'POST',
        body: JSON.stringify(data)
      });
      
    case 'PUT':
      return apiRequest<Branch>(`/branches/${id}/`, {
        method: 'PUT',
        body: JSON.stringify(data)
      });
      
    case 'DELETE': {
      const response = await apiRequest<any>(`/branches/${id}/`, { method: 'DELETE' });
      return { ...response, data: response.success };
    }
    
    default:
      throw new Error('Invalid method for branch API');
  }
};

export const getBranches = () => handleBranchAPI('GET');
export const getBranchById = (id: number) => handleBranchAPI('GET', id);
export const addBranch = (branch: Omit<Branch, 'id'>) => handleBranchAPI('POST', undefined, branch);
export const updateBranch = (branch: Branch) => handleBranchAPI('PUT', branch.id, branch);
export const deleteBranch = (id: number) => handleBranchAPI('DELETE', id);

// ======== POLICY HOLDER API ========
export const getPolicyHolders = async (branchId?: number): Promise<ApiResponse<PolicyHolder[]>> => {
  const endpoint = branchId ? `/policy-holders/?branch=${branchId}` : `/policy-holders/`;
  return apiRequest<PolicyHolder[]>(endpoint);
};

export const getPolicyHolderById = async (id: number): Promise<ApiResponse<PolicyHolder>> => {
  return apiRequest<PolicyHolder>(`/policy-holders/${id}/`);
};

export const getPolicyHoldersByBranch = async (branchId: number): Promise<ApiResponse<PolicyHolder[]>> => {
  return apiRequest<PolicyHolder[]>(`/policy-holders/?branch=${branchId}`);
};

// ======== AGENT API ========

/**
 * Fetches all sales agents.
 * GET /api/sales-agents/
 */

export const getAgents = async (): Promise<ApiResponse<SalesAgent[]>> => {
  console.log("Fetching all sales agents from API...");
  
  try {
    // Make the API request
    const response = await apiRequest<SalesAgent[]>(ENDPOINTS.AGENTS);
    
    // Log the response for debugging
    console.log("Sales agents API response:", { 
      success: response.success, 
      status: response.status,
      dataCount: Array.isArray(response.data) ? response.data.length : 'not an array',
      message: response.message
    });
    
    // Ensure the data is processed correctly before returning
    if (response.success) {
      // Ensure data is always an array
      if (!Array.isArray(response.data)) {
        console.warn("API returned non-array data for agents. Attempting to convert.");
        
        // If it's a single object with agent properties, wrap in array
        if (response.data && typeof response.data === 'object' && 'id' in response.data) {
          response.data = [response.data];
        }
        // If it's an object containing an array, extract the array
        else if (response.data && typeof response.data === 'object') {
          const possibleArrays = Object.values(response.data).filter(value => Array.isArray(value));
          if (possibleArrays.length > 0) {
            response.data = possibleArrays[0];
          } else {
            response.data = [];
          }
        } else {
          response.data = [];
        }
      }
      
      // Check if we got an empty array
      if (Array.isArray(response.data) && response.data.length === 0) {
        console.warn("API returned empty array of sales agents. Check if this is expected.");
      }
    }
    
    return response;
  } catch (error) {
    console.error("Error fetching sales agents:", error);
    // Construct error response
    return {
      success: false,
      status: 0,
      message: error instanceof Error ? error.message : "Unknown error fetching agents",
      data: []
    };
  }
};

/**
 * Fetches a specific sales agent by ID.
 * GET /api/sales-agents/{id}/
 */
export const getAgentById = async (id: number): Promise<ApiResponse<SalesAgent>> => {
  console.log(`Fetching sales agent with ID ${id}`);
  try {
    const response = await apiRequest<SalesAgent>(`/sales-agents/${id}/`);
    return response;
  } catch (error) {
    console.error(`Error fetching agent ID ${id}:`, error);
    return {
      success: false,
      status: 0,
      message: error instanceof Error ? error.message : "Unknown error fetching agent by ID",
      data: null
    };
  }
};

/**
 * Fetches sales agents for a specific branch.
 * GET /api/sales-agents/?branch={branchId}
 */
export const getAgentsByBranch = async (branchId: number): Promise<ApiResponse<SalesAgent[]>> => {
  console.log(`Fetching sales agents for branch ${branchId}`);
  try {
    const response = await apiRequest<SalesAgent[]>(`/sales-agents/?branch=${branchId}`);
    
    // Ensure data is always an array
    if (response.success && !Array.isArray(response.data)) {
      console.warn("Branch API returned non-array data for agents. Attempting to convert.");
      
      // If it's a single object with agent properties, wrap in array
      if (response.data && typeof response.data === 'object' && 'id' in response.data) {
        response.data = [response.data];
      }
      // If it's an object containing an array, extract the array
      else if (response.data && typeof response.data === 'object') {
        const possibleArrays = Object.values(response.data).filter(value => Array.isArray(value));
        if (possibleArrays.length > 0) {
          response.data = possibleArrays[0];
        } else {
          response.data = [];
        }
      } else {
        response.data = [];
      }
    }
    
    return response;
  } catch (error) {
    console.error(`Error fetching agents for branch ${branchId}:`, error);
    return {
      success: false,
      status: 0,
      message: error instanceof Error ? error.message : "Unknown error fetching branch agents",
      data: []
    };
  }
};

// ======== AGENT REPORTS API ========
export const getAgentReports = async (): Promise<ApiResponse<AgentReport[]>> => {
  return apiRequest<AgentReport[]>(`/agent-reports/`);
};

export const getAgentReportsByBranch = async (branchId: number): Promise<ApiResponse<AgentReport[]>> => {
  return apiRequest<AgentReport[]>(`/agent-reports/?branch=${branchId}`);
};

// ======== CUSTOMER API ========
export const getCustomers = async (): Promise<ApiResponse<Customer[]>> => {
  return apiRequest<Customer[]>(`/customers/`);
};

export const getCustomerById = async (id: number): Promise<ApiResponse<Customer>> => {
  return apiRequest<Customer>(`/customers/${id}/`);
};

// ======== AUTH API ========

export const login = async (username: string, password: string): Promise<ApiResponse<User>> => {
    try {
      console.log(`Attempting login for ${username} to /login/`);
      
      // Store which auth format worked so we can use it later
      let workingAuthFormat = 'bearer'; // default
      
      const result = await apiRequest<{token: string, user: User}>(`/login/`, {
        method: 'POST',
        body: JSON.stringify({ username, password }),
      });
      
      if (result.success && result.data?.token) {
        // Save token to localStorage
        console.log("Login successful, saving token");
        const token = result.data.token;
        localStorage.setItem('auth_token', token);
        
        // Also store the raw token without any prefix in case that's what's needed
        localStorage.setItem('raw_auth_token', token.replace('Bearer ', '').trim());
        
        // Make test requests with different formats to see which one works
        console.log("Testing different auth formats...");
        
        try {
          // Try with Bearer prefix
          let testResult = await fetch(`${apiUrl}/branches/`, {
            method: 'GET',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token}`
            }
          });
          
          console.log(`Bearer format test: ${testResult.status}`);
          
          if (testResult.status === 200) {
            console.log("Bearer token format works!");
            workingAuthFormat = 'bearer';
          } else {
            // Try without any prefix
            testResult = await fetch(`${apiUrl}/branches/`, {
              method: 'GET',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': token
              }
            });
            
            console.log(`Raw token test: ${testResult.status}`);
            
            if (testResult.status === 200) {
              console.log("Raw token format works!");
              workingAuthFormat = 'raw';
            } else {
              // Try with Token prefix
              testResult = await fetch(`${apiUrl}/branches/`, {
                method: 'GET',
                headers: {
                  'Content-Type': 'application/json',
                  'Authorization': `Token ${token}`
                }
              });
              
              console.log(`Token prefix test: ${testResult.status}`);
              
              if (testResult.status === 200) {
                console.log("Token prefix format works!");
                workingAuthFormat = 'token';
              }
            }
          }
          
          // Save the working format to localStorage
          localStorage.setItem('auth_format', workingAuthFormat);
          
        } catch (e) {
          console.warn("Auth format tests failed:", e);
        }
        
        return {
          ...result,
          data: result.data.user
        } as ApiResponse<User>;
      }
      
      return {
        data: null as any,
        status: result.status,
        message: result.message || 'Authentication failed',
        success: false
      };
    } catch (error) {
      console.error('Login failed:', error);
      
      return {
        data: null as any,
        status: 0,
        message: `Login failed: ${(error as Error).message}`,
        success: false
      };
    }
  };

export const logout = async (): Promise<ApiResponse<boolean>> => {
  const token = localStorage.getItem('auth_token');
  
  if (!token) {
    return {
      data: true,
      status: 200,
      message: "Already logged out",
      success: true
    };
  }
  
  try {
    const response = await fetch(`${apiUrl}/logout/`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    localStorage.removeItem('auth_token');
    
    return {
      data: true,
      status: response.status,
      message: response.ok ? "Logged out successfully" : "Logout failed",
      success: response.ok
    };
  } catch (error) {
    console.error('Logout failed:', error);
    localStorage.removeItem('auth_token'); // Still remove token on error
    
    return {
      data: true, // Still indicate success since we removed the token
      status: 0,
      message: `Logout had network error but token was cleared: ${(error as Error).message}`,
      success: true
    };
  }
};

// ======== COMPANY API ========
export const getCompanies = async (): Promise<ApiResponse<Company[]>> => {
  return apiRequest<Company[]>(`/companies/`);
};

// ======== POLICY API ========

// Policy API Functions
export const getPolicies = async (): Promise<ApiResponse<Policy[]>> => {
  return apiRequest<Policy[]>(`/insurance-policies/`);
};

export const getPolicyById = async (id: number): Promise<ApiResponse<Policy>> => {
  return apiRequest<Policy>(`/insurance-policies/${id}/`);
};

export const addPolicy = async (policy: Omit<Policy, 'id' | 'created_at' | 'gsv_rates' | 'ssv_configs'>): Promise<ApiResponse<Policy>> => {
  return apiRequest<Policy>(`/insurance-policies/`, {
    method: 'POST',
    body: JSON.stringify(policy)
  });
};

export const updatePolicy = async (id: number, policy: Partial<Policy>): Promise<ApiResponse<Policy>> => {
  return apiRequest<Policy>(`/insurance-policies/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(policy)
  });
};

export const deletePolicy = async (id: number): Promise<ApiResponse<boolean>> => {
  const response = await apiRequest<any>(`/insurance-policies/${id}/`, {
    method: 'DELETE'
  });
  return {
    ...response,
    data: response.success
  };
};

// GSV Rates API Functions
export const getGSVRates = async (policyId: number): Promise<ApiResponse<GSVRate[]>> => {
  return apiRequest<GSVRate[]>(`/gsv-rates/?policy=${policyId}`);
};

export const addGSVRate = async (policyId: number, gsvRate: { min_year: number; max_year: number; rate: string }): Promise<ApiResponse<GSVRate>> => {
  return apiRequest<GSVRate>(`/gsv-rates/`, {
    method: 'POST',
    body: JSON.stringify({
      ...gsvRate,
      policy: policyId
    })
  });
};

export const updateGSVRate = async (gsvRateId: number, gsvRate: { min_year: number; max_year: number; rate: string }): Promise<ApiResponse<GSVRate>> => {
  return apiRequest<GSVRate>(`/gsv-rates/${gsvRateId}/`, {
    method: 'PATCH',
    body: JSON.stringify(gsvRate)
  });
};

export const deleteGSVRate = async (gsvRateId: number): Promise<ApiResponse<boolean>> => {
  const response = await apiRequest<any>(`/gsv-rates/${gsvRateId}/`, {
    method: 'DELETE'
  });
  return {
    ...response,
    data: response.success
  };
};

// SSV Config API Functions
export const getSSVConfigs = async (policyId: number): Promise<ApiResponse<SSVConfig[]>> => {
  return apiRequest<SSVConfig[]>(`/ssv-configs/?policy=${policyId}`);
};

export const addSSVConfig = async (policyId: number, ssvConfig: {
  min_year: number;
  max_year: number;
  ssv_factor: string;
  eligibility_years: number;
  custom_condition: string;
}): Promise<ApiResponse<SSVConfig>> => {
  return apiRequest<SSVConfig>(`/ssv-configs/`, {
    method: 'POST',
    body: JSON.stringify({
      ...ssvConfig,
      policy: policyId
    })
  });
};

export const updateSSVConfig = async (ssvConfigId: number, ssvConfig: {
  min_year: number;
  max_year: number;
  ssv_factor: string;
  eligibility_years: number;
  custom_condition: string;
}): Promise<ApiResponse<SSVConfig>> => {
  return apiRequest<SSVConfig>(`/ssv-configs/${ssvConfigId}/`, {
    method: 'PATCH',
    body: JSON.stringify(ssvConfig)
  });
};

export const deleteSSVConfig = async (ssvConfigId: number): Promise<ApiResponse<boolean>> => {
  const response = await apiRequest<any>(`/ssv-configs/${ssvConfigId}/`, {
    method: 'DELETE'
  });
  return {
    ...response,
    data: response.success
  };
};

// ======== PREMIUM PAYMENTS API ========
export const getPremiumPayments = async (): Promise<ApiResponse<any[]>> => {
  return apiRequest<any[]>(`/premium-payments/`);
};

export const addPremiumPayment = async (payment: any): Promise<ApiResponse<any>> => {
  return apiRequest<any>(`/premium-payments/`, {
    method: 'POST',
    body: JSON.stringify(payment)
  });
};

export const updatePremiumPayment = async (id: number, payment: any): Promise<ApiResponse<any>> => {
  return apiRequest<any>(`/premium-payments/${id}/`, {
    method: 'PUT',
    body: JSON.stringify(payment)
  });
};

// ======== KYC API ========
export const getKYC = async (): Promise<ApiResponse<any[]>> => {
  return apiRequest<any[]>(`/kyc/`);
};

// ======== CLAIMS API ========
export const getClaimRequests = async (): Promise<ApiResponse<any[]>> => {
  return apiRequest<any[]>(`/claim-requests/`);
};

export const getClaimProcessing = async (): Promise<ApiResponse<any[]>> => {
  return apiRequest<any[]>(`/claim-processing/`);
};

// ======== LOANS API ========
export const getLoans = async (): Promise<ApiResponse<Loan[]>> => {
  return apiRequest<Loan[]>(`/loans/`);
};

export const getLoanById = async (id: number): Promise<ApiResponse<Loan>> => {
  return apiRequest<Loan>(`/loans/${id}/`);
};

export const addLoan = async (loan: Omit<Loan, 'id' | 'created_at' | 'updated_at'>): Promise<ApiResponse<Loan>> => {
  return apiRequest<Loan>(`/loans/`, {
    method: 'POST',
    body: JSON.stringify(loan)
  });
};

export const updateLoan = async (id: number, loan: Partial<Loan>): Promise<ApiResponse<Loan>> => {
  return apiRequest<Loan>(`/loans/${id}/`, {
    method: 'PATCH',
    body: JSON.stringify(loan)
  });
};

export const deleteLoan = async (id: number): Promise<ApiResponse<boolean>> => {
  const response = await apiRequest<any>(`/loans/${id}/`, {
    method: 'DELETE'
  });
  return {
    ...response,
    data: response.success
  };
};

export const getLoanRepayments = async (): Promise<ApiResponse<LoanRepayment[]>> => {
  return apiRequest<LoanRepayment[]>(`/loan-repayments/`);
};

export const getLoanRepaymentById = async (id: number): Promise<ApiResponse<LoanRepayment>> => {
  return apiRequest<LoanRepayment>(`/loan-repayments/${id}/`);
};

export const addLoanRepayment = async (repayment: Omit<LoanRepayment, 'id'>): Promise<ApiResponse<LoanRepayment>> => {
  return apiRequest<LoanRepayment>(`/loan-repayments/`, {
    method: 'POST',
    body: JSON.stringify(repayment)
  });
};

// ======== DASHBOARD STATISTICS API ========
export const getDashboardStats = async (): Promise<ApiResponse<any>> => {
  // Using the improved apiRequest with better error handling
  const response = await apiRequest<any>('/home/', {
    credentials: 'include',
  });
  
  // Log the response for debugging
  console.log('Dashboard API raw response:', response);
  
  // If we got data back but it's not in the expected format, 
  // transform it to match our expected structure
  if (response.success && response.data) {
    // Some backend APIs might return the data in a different structure
    // This handles potential format differences
    const data = response.data;
    
    // Example data transformation if needed - adjust according to your API response
    if (Array.isArray(data) || (typeof data === 'object' && !data.totalPolicies)) {
      // Handle case where data is in unexpected format
      // For example, if data is returned as separate collections like your JSON example
      const transformedData = {
        totalPolicies: data.policy_holders?.length || 0,
        activePolicies: data.policy_holders?.filter(p => p.status === 'Active')?.length || 0,
        totalCustomers: data.customers?.length || 0,
        totalAgents: data.sales_agents?.length || 0,
        totalPremium: data.premium_payments?.reduce((sum, payment) => sum + parseFloat(payment.total_paid || '0'), 0) || 0,
        pendingClaims: data.claim_requests?.filter(claim => claim.status === 'Pending')?.length || 0,
        duePayments: data.premium_payments?.reduce((sum, payment) => sum + parseFloat(payment.remaining_premium || '0'), 0) || 0,
        activeLoans: data.loans?.filter(loan => loan.loan_status === 'Active')?.length || 0,
        totalLoanAmount: data.loans?.reduce((sum, loan) => sum + parseFloat(loan.loan_amount || '0'), 0) || 0,
        totalRepayments: data.loan_repayments?.reduce((sum, repayment) => sum + parseFloat(repayment.amount || '0'), 0) || 0,
        pendingLoans: data.loans?.filter(loan => loan.loan_status === 'Pending')?.length || 0
      };
      
      return {
        ...response,
        data: transformedData
      };
    }
  }
  
  return response;
};

// ======== UNDERWRITING API ========
export const getUnderwritingData = async (): Promise<ApiResponse<any[]>> => {
  return apiRequest<any[]>(`/underwriting/`);
};

// ======================
// User Management API
// ======================

type CreateUserData = Omit<User, 'id' | 'created_at' | 'updated_at' | 'last_login' | 'is_superuser' | 'is_staff' | 'agent' | 'groups' | 'user_permissions'> & { password?: string }; // Password might be optional if set separately
type UpdateUserData = Partial<Omit<User, 'id' | 'created_at' | 'updated_at' | 'last_login' | 'password' | 'is_superuser' | 'is_staff' | 'agent' | 'groups' | 'user_permissions'>>;

/**
 * Fetches all users.
 * GET /api/users/
 */
export const getUsers = async (): Promise<ApiResponse<User[]>> => {
   
    return await apiRequest<User[]>(`/users/`);
};

/**
 * Adds a new user.
 * POST /api/users/
 */
export const addUser = async (userData: CreateUserData): Promise<ApiResponse<User>> => {
    console.log("Creating new user:", userData);
    return await apiRequest<User>(`/users/`, {
        method: 'POST',
        body: JSON.stringify(userData)
    });
};

/**
 * Updates an existing user.
 * PATCH /api/users/{id}/
 */
export const updateUser = async (userId: number, userData: UpdateUserData): Promise<ApiResponse<User>> => {
    console.log(`Updating user ${userId}:`, userData);
    return await apiRequest<User>(`/users/${userId}/`, {
        method: 'PATCH',
        body: JSON.stringify(userData)
    });
};

/**

 * DELETE /api/users/{id}/
 */
export const deleteUser = async (userId: number): Promise<ApiResponse<boolean>> => {
    console.log(`Deleting user ${userId}`);
    const response = await apiRequest<any>(`/users/${userId}/`, {
        method: 'DELETE'
    });
    return {
        ...response,
        data: response.success
    };
};

// ======================
// Agent Management API
// ======================

// Type for creating an agent (assuming linking to a User happens elsewhere or needs specific data)
type CreateAgentData = Omit<SalesAgent, 'id' | 'total_policies_sold' | 'total_premium_collected' | 'commission_rate' | 'user_details'>;
// Type for updating an agent
type UpdateAgentData = Partial<CreateAgentData>;

/**
 * Adds a new Sales Agent.
 * POST /api/sales-agents/
 */
export const addAgent = async (agentData: CreateAgentData): Promise<ApiResponse<SalesAgent>> => {
    console.log("Creating new sales agent:", agentData);
    return await apiRequest<SalesAgent>(`/sales-agents/`, {
        method: 'POST',
        body: JSON.stringify(agentData)
    });
};

/**
 * Updates an existing Sales Agent.
 * PATCH /api/sales-agents/{id}/
 */
export const updateAgent = async (agentId: number, agentData: UpdateAgentData): Promise<ApiResponse<SalesAgent>> => {
    console.log(`Updating sales agent ${agentId}:`, agentData);
    return await apiRequest<SalesAgent>(`/sales-agents/${agentId}/`, {
        method: 'PATCH',
        body: JSON.stringify(agentData)
    });
};

/**
 * Deletes a Sales Agent.
 * DELETE /api/sales-agents/{id}/
 */
export const deleteAgent = async (agentId: number): Promise<ApiResponse<boolean>> => {
    console.log(`Deleting sales agent ${agentId}`);
    const response = await apiRequest<any>(`/sales-agents/${agentId}/`, {
        method: 'DELETE'
    });
    return {
        ...response,
        data: response.success
    };
};

// ==============================
// Agent Application Management API
// ==============================

// Type for creating an application (likely simpler than the full type)
type CreateAgentApplicationData = Omit<AgentApplication, 
  'id' | 'status' | 'created_at' | 'rejection_reason' | 'branch_name' |
  'resume' | 'citizenship_front' | 'citizenship_back' | 'license_front' | 'license_back' | 'pp_photo'
>;

/**
 * Fetches all Agent Applications (SuperAdmin).
 * GET /api/agent-applications/
 */
export const getAgentApplications = async (): Promise<ApiResponse<AgentApplication[]>> => {
    console.log("Fetching all agent applications (SuperAdmin)");
    
    try {
      // Make the API request
      const response = await apiRequest<AgentApplication[]>(ENDPOINTS.AGENT_APPLICATIONS);
      
      // Log the response for debugging
      console.log("Agent applications API response:", { 
        success: response.success, 
        status: response.status,
        dataLength: Array.isArray(response.data) ? response.data.length : 'not an array',
        message: response.message
      });
      
      // If data is available, log the first item for debugging
      if (response.success && Array.isArray(response.data) && response.data.length > 0) {
        console.log("Sample application data:", response.data[0]);
      }
      
      return response;
    } catch (error) {
      console.error("Error fetching agent applications:", error);
      throw error;
    }
};

/**
 * Fetches Agent Applications for a specific branch (Branch Admin).
 * GET /api/agent-applications/?branch={branchId}
 */
export const getAgentApplicationsByBranch = async (branchId: number): Promise<ApiResponse<AgentApplication[]>> => {
    console.log(`Fetching agent applications for branch ${branchId}`);
    
    try {
      // Make the API request
      const response = await apiRequest<AgentApplication[]>(`${ENDPOINTS.AGENT_APPLICATIONS}?branch=${branchId}`);
      
      // Log the response for debugging
      
      // If data is available, log the first item for debugging
      if (response.success && Array.isArray(response.data) && response.data.length > 0) {
        console.log("Sample branch application data:", response.data[0]);
      } else if (Array.isArray(response.data) && response.data.length === 0) {
        console.log(`No applications found for branch ${branchId}`);
      }
      
      return response;
    } catch (error) {
      console.error(`Error fetching applications for branch ${branchId}:`, error);
      throw error;
    }
};

/**
 * Adds a new Agent Application.
 * POST /api/agent-applications/
 */
export const addAgentApplication = async (data: FormData | CreateAgentApplicationData): Promise<ApiResponse<AgentApplication>> => {
  console.log("Creating new agent application");
  
  try {
    // For real API
    const options: RequestInit = {
      method: 'POST',
    };
    
    if (data instanceof FormData) {
      console.log("Submitting as FormData with files");
      // Do not set Content-Type header when sending FormData
      // The browser will automatically set the correct multipart/form-data with boundary
      options.body = data;
    } else {
      console.log("Submitting as JSON data", data);
      options.headers = {
        'Content-Type': 'application/json'
      };
      options.body = JSON.stringify(data);
    }
    
    return await apiRequest<AgentApplication>(`/agent-applications/`, options);
  } catch (error) {
    console.error('Error adding agent application:', error);
    
    // Mock response for development
    
    
    return {
      success: true,
      status: 200,
      data: data as AgentApplication,
      message: 'Agent application created successfully'
    };
  }
};



/**
 * Updates the status of an Agent Application.
 * PATCH /api/agent-applications/{id}/status/
 */
export const updateAgentApplicationStatus = async (
    applicationId: number, 
    status: 'APPROVED' | 'REJECTED', 
    rejection_reason?: string
): Promise<ApiResponse<AgentApplication>> => {
    console.log(`Updating application ${applicationId} status to ${status}`);
    
    const payload: { status: string; rejection_reason?: string } = { status };
    if (status === 'REJECTED' && rejection_reason) {
        payload.rejection_reason = rejection_reason;
    }
    
    // Try first with the status-specific endpoint
    try {
        return await apiRequest<AgentApplication>(`${ENDPOINTS.AGENT_APPLICATIONS}${applicationId}/status/`, {
            method: 'PATCH',
            body: JSON.stringify(payload)
        });
    } catch (error) {
        console.error(`Error using status endpoint: ${error}`);
        
        // Fallback to direct update if status endpoint fails
        console.log(`Trying direct update to application instead`);
        try {
            return await apiRequest<AgentApplication>(`${ENDPOINTS.AGENT_APPLICATIONS}${applicationId}/`, {
                method: 'PATCH',
                body: JSON.stringify(payload)
            });
        } catch (secondError) {
            console.error(`Direct update also failed: ${secondError}`);
            throw secondError;
        }
    }
};

// ======== MORTALITY RATES API ========
export const getMortalityRates = async (): Promise<ApiResponse<any[]>> => {
  return apiRequest<any[]>(API_ENDPOINTS.MORTALITY_RATES.LIST);
};

export const addMortalityRate = async (rate: { age_group_start: number; age_group_end: number; rate: number }): Promise<ApiResponse<any>> => {
  return apiRequest<any>(API_ENDPOINTS.MORTALITY_RATES.CREATE, {
    method: 'POST',
    body: JSON.stringify(rate)
  });
};

export const updateMortalityRate = async (id: number, rate: { age_group_start: number; age_group_end: number; rate: number }): Promise<ApiResponse<any>> => {
  return apiRequest<any>(API_ENDPOINTS.MORTALITY_RATES.UPDATE(id), {
    method: 'PATCH',
    body: JSON.stringify(rate)
  });
};

export const deleteMortalityRate = async (id: number): Promise<ApiResponse<boolean>> => {
  const response = await apiRequest<any>(API_ENDPOINTS.MORTALITY_RATES.DELETE(id), {
    method: 'DELETE'
  });
  return {
    ...response,
    data: response.success
  };
}; 