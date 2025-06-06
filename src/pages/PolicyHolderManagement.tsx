import React from 'react';
import { DashboardLayout } from '@/components/DashboardLayout';
import { PolicyHolderList } from '@/components/policyholder/PolicyHolderList';
import { UnderwritingDetails } from '@/components/policyholder/UnderwritingDetails';
import { AddPolicyHolderDialog } from '@/components/policyholder/AddPolicyHolderDialog';
import { useAuth } from '@/hooks/useAuth';
import { Input } from '@/components/ui/input';
import { Search, ArrowLeft } from 'lucide-react';
import { PolicyHolder } from '@/types';

export default function PolicyHolderManagement() {
  const { user } = useAuth();
  const [searchTerm, setSearchTerm] = React.useState('');
  const [selectedPolicyHolder, setSelectedPolicyHolder] = React.useState<PolicyHolder | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = React.useState(false);

  const handleSelectPolicyHolder = (policyHolder: PolicyHolder) => {
    setSelectedPolicyHolder(policyHolder);
  };

  const handleBackToList = () => {
    setSelectedPolicyHolder(null);
  };

  const canEdit = user?.role === 'superadmin' || user?.role === 'branch';

  return (
    <DashboardLayout>
      <div className="space-y-6 h-full">
        {!selectedPolicyHolder ? (
          // List View (Full Screen)
          <>
            <div className="flex justify-between items-center">
              <h1 className="text-3xl font-bold">Policy Holder Management</h1>
              {canEdit && (
                <button
                  onClick={() => setIsAddDialogOpen(true)}
                  className="px-4 py-2 bg-primary text-primary-foreground rounded-md hover:bg-primary/90"
                >
                  Add New Policy Holder
                </button>
              )}
            </div>

            <div className="relative">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Search policy holders..."
                className="pl-10"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <div className="w-full">
              <PolicyHolderList
                searchTerm={searchTerm}
                onSelectPolicyHolder={handleSelectPolicyHolder}
                canEdit={canEdit}
              />
            </div>
          </>
        ) : (
          // Detail View
          <>
            <div className="mb-6">
              <button
                onClick={handleBackToList}
                className="flex items-center text-primary hover:text-primary/90 mb-4"
              >
                <ArrowLeft className="mr-2 h-4 w-4" />
                Back to Policy Holders
              </button>
              
              <h1 className="text-3xl font-bold">
                {selectedPolicyHolder.customer_name}
              </h1>
              <p className="text-muted-foreground">
                Policy Number: {selectedPolicyHolder.policy_number}
              </p>
            </div>

            <div className="w-full">
              <UnderwritingDetails
                policyHolder={selectedPolicyHolder}
                canEdit={canEdit}
              />
            </div>
          </>
        )}
      </div>

      <AddPolicyHolderDialog
        open={isAddDialogOpen}
        onOpenChange={setIsAddDialogOpen}
      />
    </DashboardLayout>
  );
}