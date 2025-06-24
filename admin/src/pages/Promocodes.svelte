<script lang="ts">
    import { onMount } from "svelte";
    import Main from "../components/templates/Main.svelte";
    import request from "../lib/request";
    import * as rank from "../stores/rank";

    let code: string = "";
    let assetId: string = "";
    let robuxAmount: string = "";
    let expiresInValue: string = "";
    let expiresInUnit: 'seconds' | 'minutes' | 'hours' | 'days' = 'hours';
    let expiresNever: boolean = true;
    let maxUses: string = "1";
    let isActive: boolean = true;

    let promoCodes: PromoCodeEntry[] = [];
    let selectedPromoCode: PromoCodeEntry | null = null;
    let redemptions: PromoCodeRedemptionEntry[] = [];
    let limit: string = "1000000";
    let offset: string = "0";

    let disabled = false;
    let loading = false;
    let listLoading = false;
    let redemptionLoading = false;
    let errorMessage: string | undefined;
    let successMessage: string | undefined;
    let activeTab: 'create' | 'list' = 'create';

    interface PromoCodeEntry {
        id: number;
        code: string;
        asset_id: number | null;
        robux_amount: number | null;
        created_at: string;
        expires_at: string | null;
        max_uses: number;
        use_count: number;
        is_active: boolean;
    }
    
    interface PromoCodeRedemptionEntry {
        id: number;
        promocode_id: number;
        user_id: number;
        redeemed_at: string;
        asset_id: number | null;
        robux_amount: number | null;
        username: string;
    }
    
    rank.promise.then(() => {
        if (!rank.hasPermission("GiveUserItem")) {
            errorMessage = "You don't have permission to manage Promocodes";
            disabled = true;
        }
    });
    
    async function loadPromoCodes() {
        try {
            listLoading = true;
            errorMessage = undefined;
            const response = await request.get(`/promocodes/list?limit=${limit}&offset=${offset}`);

            promoCodes = Array.isArray(response) ? response : response.data;
            
            if (!Array.isArray(promoCodes)) {
                throw new Error("Invalid response format from server");
            }
        } catch (error) {
            console.error("Failed to load Promocodes:", error);
            errorMessage = error.message || "Failed to load Promocodes";
            promoCodes = [];
        } finally {
            listLoading = false;
        }
    }
	
	async function deletePromoCode(promoCodeId: number) {
        if (!confirm('Are you sure you want to delete this promocode? This action cannot be undone.')) {
            return;
        }

        try {
            loading = true;
            errorMessage = undefined;
            await request.delete(`/promocodes/delete`, {
                data: { promoCodeId }
            });
            successMessage = `Promocode deleted successfully`;
            await loadPromoCodes();
            selectedPromoCode = null;
            redemptions = [];
        } catch (error) {
            console.error("Failed to delete Promocode:", error);
            errorMessage = error.message || "Failed to delete Promocode";
        } finally {
            loading = false;
        }
    }

    async function loadRedemptions(promoCodeId: number) {
        try {
            redemptionLoading = true;
            errorMessage = undefined;
            const response = await request.get(`/promocodes/redemptions?promoCodeId=${promoCodeId}&limit=${limit}&offset=${offset}`);

            redemptions = Array.isArray(response) ? response : response.data;
            
            if (!Array.isArray(redemptions)) {
                throw new Error("Invalid response format from server");
            }
            
            selectedPromoCode = promoCodes.find(pc => pc.id === promoCodeId) || null;
        } catch (error) {
            console.error("Failed to load redemptions:", error);
            errorMessage = error.message || "Failed to load redemptions";
            redemptions = [];
        } finally {
            redemptionLoading = false;
        }
    }
    
    async function toggleActive(promoCodeId: number, currentStatus: boolean) {
        try {
            loading = true;
            errorMessage = undefined;
            await request.post(`/promocodes/toggle-active`, {
                promoCodeId,
                isActive: !currentStatus
            });
            successMessage = `Promocode ${currentStatus ? 'deactivated' : 'activated'} successfully`;
            await loadPromoCodes();
        } catch (error) {
            console.error("Failed to toggle Promocode status:", error);
            errorMessage = error.message || "Failed to toggle Promocode status";
        } finally {
            loading = false;
        }
    }

    async function createPromoCode() {
        errorMessage = undefined;
        successMessage = undefined;
        loading = true;
        
        try {
            const requestData: any = {
                Code: code.toUpperCase(),
                AssetId: assetId ? parseInt(assetId) : null,
                RobuxAmount: robuxAmount ? parseInt(robuxAmount) : null,
                MaxUses: parseInt(maxUses),
                IsActive: isActive
            };

            if (!expiresNever && expiresInValue) {
                const value = parseInt(expiresInValue);
                if (isNaN(value) || value <= 0) {
                    throw new Error("Expiration value must be a positive number");
                }

                switch (expiresInUnit) {
                    case 'seconds':
                        requestData.ExpiresInSeconds = value;
                        break;
                    case 'minutes':
                        requestData.ExpiresInMinutes = value;
                        break;
                    case 'hours':
                        requestData.ExpiresInHours = value;
                        break;
                    case 'days':
                        requestData.ExpiresInDays = value;
                        break;
                }
            }

            const response = await request.post(`/promocodes/create`, requestData);
            
            successMessage = `Promocode created successfully! You can view it in the View Promocodes section.`;
            code = "";
            assetId = "";
            robuxAmount = "";
            expiresInValue = "";
            expiresInUnit = 'hours';
            expiresNever = true;
            maxUses = "1";
            isActive = true;
            
            await loadPromoCodes();
        } catch (error) {
            console.error("Failed to create promocode:", error);
            errorMessage = error.message || "Failed to create promocode, Please try again";
        } finally {
            loading = false;
        }
    }
	
    function formatTimeRemaining(expiresAt: string | null): string {
        if (!expiresAt) return "Never";
        
        const now = new Date();
        const expiryDate = new Date(expiresAt);
        
        const nowUtc = Date.UTC(
            now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(),
            now.getUTCHours(), now.getUTCMinutes(), now.getUTCSeconds()
        );
        
        const expiryUtc = expiryDate.getTime();
        const diffMs = expiryUtc - nowUtc;
        
        if (diffMs <= 0) return "Expired";
        
        const diffSec = Math.round(diffMs / 1000);
        const diffMin = Math.round(diffMs / (1000 * 60));
        const diffHours = Math.round(diffMs / (1000 * 60 * 60));
        const diffDays = Math.round(diffMs / (1000 * 60 * 60 * 24));
        
        if (diffSec < 60) return `Expires in ${diffSec} second${diffSec !== 1 ? 's' : ''}`;
        if (diffMin < 60) return `Expires in ${diffMin} minute${diffMin !== 1 ? 's' : ''}`;
        if (diffHours < 24) return `Expires in ${diffHours} hour${diffHours !== 1 ? 's' : ''}`;
        return `Expires in ${diffDays} day${diffDays !== 1 ? 's' : ''}`;
    }

    onMount(() => {
        loadPromoCodes();
    });
</script>

<svelte:head>
    <title>Promocodes</title>
</svelte:head>

<Main>
    <div class="row">
        <div class="col-12">
            <h1>Promocodes</h1>
            
            {#if errorMessage}
                <div class="alert alert-danger">{errorMessage}</div>
            {/if}
            
            {#if successMessage}
                <div class="alert alert-success">{successMessage}</div>
            {/if}
            
            <ul class="nav nav-tabs mb-3">
                <li class="nav-item">
                    <button 
                        class="nav-link {activeTab === 'create' ? 'active' : ''}" 
                        on:click={() => activeTab = 'create'}
                    >
                        Create a Promocode
                    </button>
                </li>
                <li class="nav-item">
                    <button 
                        class="nav-link {activeTab === 'list' ? 'active' : ''}" 
                        on:click={() => {
                            activeTab = 'list';
                            loadPromoCodes();
                        }}
                    >
                        View Promocodes
                    </button>
                </li>
            </ul>
        </div>
        
        {#if activeTab === 'create'}
            <div class="col-12 mt-3">
                <form on:submit|preventDefault={createPromoCode}>
                    <div class="mb-3">
                        <label for="code" class="form-label">Promocode *</label>
                        <input 
                            type="text" 
                            class="form-control" 
                            id="code" 
                            bind:value={code}
                            placeholder="Code"
                            required
                            minlength="4"
                            maxlength="50"
                            disabled={disabled || loading}
                        />
                    </div>
                    
                    <div class="row">
                        <div class="col-md-6 mb-3">
                            <label for="asset-id" class="form-label">Asset ID</label>
                            <input 
                                type="number" 
                                class="form-control" 
                                id="asset-id" 
                                bind:value={assetId}
                                placeholder="Optional - leave blank for Robux only"
                                disabled={disabled || loading || !!robuxAmount}
                            />
							<div class="form-text">You must have at least Robux or an Asset ID</div>
                        </div>
                        
                        <div class="col-md-6 mb-3">
                            <label for="robux-amount" class="form-label">Robux</label>
                            <input 
                                type="number" 
                                class="form-control" 
                                id="robux-amount" 
                                bind:value={robuxAmount}
                                placeholder="Optional - leave blank for asset only"
                                min="0"
                                max="1000000"
                                disabled={disabled || loading || !!assetId}
                            />
                        </div>
                    </div>
                    
					<div class="row">
						<div class="col-md-6 mb-3">
							<label class="form-label">Expiration</label>
							<div class="input-group">
								<div class="form-check">
									<input 
										type="checkbox" 
										class="form-check-input" 
										id="expires-never" 
										bind:checked={expiresNever}
										disabled={disabled || loading}
									/>
									<label class="form-check-label" for="expires-never">Never</label>
								</div>
							</div>
							{#if !expiresNever}
								<div class="input-group mt-2">
									<input 
										type="number" 
										class="form-control" 
										bind:value={expiresInValue}
										placeholder="Enter value"
										min="1"
										disabled={disabled || loading}
									/>
									<select 
										class="form-select" 
										bind:value={expiresInUnit}
										disabled={disabled || loading}
									>
										<option value="seconds">Seconds from now</option>
										<option value="minutes">Minutes from now</option>
										<option value="hours" selected>Hours from now</option>
										<option value="days">Days from now</option>
									</select>
								</div>
							{/if}
						</div>               
    
						<div class="col-md-6 mb-3">
							<label for="max-uses" class="form-label">Max Uses *</label>
							<input 
								type="number" 
								class="form-control" 
								id="max-uses" 
								bind:value={maxUses}
								required
								min="1"
								max="1000000"
								disabled={disabled || loading}
							/>
							<div class="form-text">Between 1 - 1 million</div>
						</div>
					</div>

                    <div class="mb-3 form-check">
                        <input 
                            type="checkbox" 
                            class="form-check-input" 
                            id="is-active" 
                            bind:checked={isActive}
                            disabled={disabled || loading}
                        />
                        <label class="form-check-label" for="is-active">Active</label>
                    </div>
                    
                    <div class="d-grid gap-2">
                        <button 
                            type="submit" 
                            class="btn btn-success"
                            disabled={disabled || loading || !code || !maxUses || (!assetId && !robuxAmount)}
                        >
                            {#if loading}
                                <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                                Creating...
                            {:else}
                                <i class="fas fa-plus-circle me-2"></i>
                                Create a Promocode
                            {/if}
                        </button>
                    </div>
                </form>
            </div>
        {:else}
            <div class="col-12 mt-3">
                <div class="card">
					<div class="card-header d-flex justify-content-between align-items-center">
						<h5 class="mb-0">Promocodes</h5>
						<button class="btn btn-primary btn-sm" on:click={loadPromoCodes} disabled={listLoading}>
							{#if listLoading}
								<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
								Refreshing...
							{:else}
								<i class="fas fa-sync-alt me-1"></i>
								Refresh
							{/if}
						</button>
					</div>
                    <div class="card-body">
                        {#if listLoading}
                            <div class="text-center py-4">
                                <div class="spinner-border text-primary" role="status">
                                    <span class="visually-hidden">Loading...</span>
                                </div>
                                <p class="mt-2">Loading promocodes...</p>
                            </div>
                        {:else if promoCodes.length === 0}
                            <div class="alert alert-info">No promocodes found</div>
                        {:else}
                            <div class="table-responsive">
                                <table class="table table-striped table-hover">
                                    <thead>
                                        <tr>
                                            <th>ID</th>
                                            <th>Code</th>
                                            <th>Reward</th>
                                            <th>Uses</th>
                                            <th>Status</th>
                                            <th>Created</th>
                                            <th>Expires</th>
                                            <th>Actions</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {#each promoCodes as promoCode}
                                            <tr class={selectedPromoCode?.id === promoCode.id ? 'table-primary' : ''}>
                                                <td>{promoCode.id}</td>
                                                <td>
                                                    <code>{promoCode.code}</code>
                                                    {#if promoCode.use_count >= promoCode.max_uses}
                                                        <span class="badge bg-danger ms-2">MAX</span>
                                                    {/if}
                                                </td>
                                                <td>
                                                    {#if promoCode.asset_id}
                                                        Asset #{promoCode.asset_id}
                                                    {:else if promoCode.robux_amount}
                                                        {promoCode.robux_amount} Robux
                                                    {/if}
                                                </td>
                                                <td>{promoCode.use_count}/{promoCode.max_uses}</td>
                                                <td>
                                                    {#if promoCode.is_active}
                                                        <span class="badge bg-success">Active</span>
                                                    {:else}
                                                        <span class="badge bg-secondary">Inactive</span>
                                                    {/if}
                                                </td>
                                                <td>{new Date(promoCode.created_at).toLocaleString()}</td>
												<td>
													{#if promoCode.expires_at}
														{formatTimeRemaining(promoCode.expires_at)}
													{:else}
														Never
													{/if}
												</td>
												<td>
													<div class="btn-group btn-group-sm">
														<button 
															class="btn btn-primary"
															on:click={() => loadRedemptions(promoCode.id)}
															disabled={redemptionLoading}
															title="View redemptions"
														>
															{#if redemptionLoading && selectedPromoCode?.id === promoCode.id}
																<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
															{:else}
																<i class="fas fa-history me-1"></i>
															{/if}
															View
														</button>
														<button 
															class="btn {promoCode.is_active ? 'btn-warning' : 'btn-success'}"
															on:click={() => toggleActive(promoCode.id, promoCode.is_active)}
															disabled={loading}
															title={promoCode.is_active ? 'Deactivate' : 'Activate'}
														>
															{#if loading}
																<span class="spinner-border spinner-border-sm me-1" role="status" aria-hidden="true"></span>
															{:else}
																<i class="fas {promoCode.is_active ? 'fa-toggle-off' : 'fa-toggle-on'} me-1"></i>
															{/if}
															{promoCode.is_active ? 'Deactivate' : 'Activate'}
														</button>
														<button 
															class="btn btn-danger"
															on:click={() => deletePromoCode(promoCode.id)}
															disabled={loading}
															title="Delete"
														>
															<i class="fas fa-trash-alt me-1"></i>
															Delete
														</button>
													</div>
												</td>
                                            </tr>
                                        {/each}
                                    </tbody>
                                </table>
                            </div>
                        {/if}
                    </div>
                </div>
                
                {#if selectedPromoCode}
                    <div class="card mt-3">
                        <div class="card-header">
                            <h5 class="mb-0">Redemptions for <code>{selectedPromoCode.code}</code></h5>
                        </div>
                        <div class="card-body">
                            {#if redemptionLoading}
                                <div class="text-center py-4">
                                    <div class="spinner-border text-primary" role="status">
                                        <span class="visually-hidden">Loading...</span>
                                    </div>
                                    <p class="mt-2">Loading...</p>
                                </div>
                            {:else if redemptions.length === 0}
                                <div class="alert alert-info">No redemptions found for this code</div>
                            {:else}
                                <div class="table-responsive">
                                    <table class="table table-striped table-hover">
                                        <thead>
                                            <tr>
                                                <th>User</th>
                                                <th>Reward</th>
                                                <th>Redeemed At</th>
                                            </tr>
                                        </thead>
                                        <tbody>
                                            {#each redemptions as redemption}
                                                <tr>
                                                    <td>
                                                        {#if redemption.username}
                                                            {redemption.username} (ID: {redemption.user_id})
                                                        {:else}
                                                            User ID: {redemption.user_id}
                                                        {/if}
                                                    </td>
                                                    <td>
                                                        {#if redemption.asset_id}
                                                            Asset #{redemption.asset_id}
                                                        {:else if redemption.robux_amount}
                                                            {redemption.robux_amount} Robux
                                                        {/if}
                                                    </td>
                                                    <td>{new Date(redemption.redeemed_at).toLocaleString()}</td>
                                                </tr>
                                            {/each}
                                        </tbody>
                                    </table>
                                </div>
                            {/if}
                        </div>
                    </div>
                {/if}
            </div>
        {/if}
    </div>
</Main>

<style>
    .alert {
        margin-bottom: 1rem;
    }
    .form-text {
        font-size: 0.85rem;
        color: #6c757d;
    }
    .nav-tabs {
        margin-bottom: 1rem;
    }
    .table-responsive {
        overflow-x: auto;
    }
    code {
        background-color: #f8f9fa;
        padding: 0.2rem 0.4rem;
        border-radius: 0.25rem;
    }
    .text-center {
        text-align: center;
    }
    .py-4 {
        padding-top: 1.5rem;
        padding-bottom: 1.5rem;
    }
    .mt-2 {
        margin-top: 0.5rem;
    }
    .visually-hidden {
        position: absolute;
        width: 1px;
        height: 1px;
        padding: 0;
        margin: -1px;
        overflow: hidden;
        clip: rect(0, 0, 0, 0);
        white-space: nowrap;
        border: 0;
    }
	.btn i {
        margin-right: 0.3rem;
    }
    .btn-group .btn {
        padding: 0.25rem 0.5rem;
    }
    .btn-group-sm .btn {
        font-size: 0.875rem;
    }
	.btn-icon-only {
        width: 2rem;
        padding: 0.25rem;
        display: inline-flex;
        align-items: center;
        justify-content: center;
    }
</style>