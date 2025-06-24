<script lang="ts">
    import { navigate } from "svelte-routing";
    import Main from "../components/templates/Main.svelte";
    import request from "../lib/request";
    import * as rank from "../stores/rank";

    let giftId: string = "";
    let assetIdToGive: string = "";
    let disabled = false;
    let loading = false;
    let errorMessage: string | undefined;
    let successMessage: string | undefined;

    rank.promise.then(() => {
        if (!rank.hasPermission("GiveUserItem")) {
            errorMessage = "You don't have permission to open gifts";
            disabled = true;
        }
    });
    
    async function openGift() {
        errorMessage = undefined;
        successMessage = undefined;
        loading = true;

        if (!giftId || !assetIdToGive) {
            errorMessage = "Both Gift ID and Asset ID are required";
            loading = false;
            return;
        }
        
        try {
            const response = await request.post(
                `/gift/open/${giftId}/${assetIdToGive}`
            );
            
            successMessage = `Successfully opened gift!`;
            console.log("Gift opened:", response);
            
            // Show success details
            if (response.userId) {
                successMessage += ` User ${response.username} received asset ${response.assetId}`;
            }
            
        } catch (error) {
            errorMessage = error.message || "Failed to open gift. Please try again.";
        } finally {
            loading = false;
        }
    }
</script>

<svelte:head>
    <title>Open Gift</title>
</svelte:head>

<Main>
    <div class="row">
        <div class="col-12">
            <h1>Open Gift</h1>
            
            {#if errorMessage}
                <div class="alert alert-danger">{errorMessage}</div>
            {/if}
            
            {#if successMessage}
                <div class="alert alert-success">{successMessage}</div>
            {/if}
        </div>
        
        <div class="col-12 mt-3">
            <form on:submit|preventDefault={openGift}>
                <div class="mb-3">
                    <label for="gift-id" class="form-label">Gift ID *</label>
                    <input 
                        type="number" 
                        class="form-control" 
                        id="gift-id" 
                        bind:value={giftId}
                        placeholder="The asset ID of the gift"
                        required
                        disabled={disabled || loading}
                    />
                </div>
                
                <div class="mb-3">
                    <label for="asset-id" class="form-label">Asset ID to give *</label>
                    <input 
                        type="number" 
                        class="form-control" 
                        id="asset-id" 
                        bind:value={assetIdToGive}
                        placeholder="The asset ID to give the user"
                        required
                        disabled={disabled || loading}
                    />
                </div>
                
                <div class="d-grid gap-2">
                    <button 
                        type="submit" 
                        class="btn btn-success"
                        disabled={disabled || loading || !giftId || !assetIdToGive}
                    >
                        {#if loading}
                            <span class="spinner-border spinner-border-sm" role="status" aria-hidden="true"></span>
                            Opening Gift...
                        {:else}
                            <i class="fas fa-gift me-2"></i>
                            Open Gift
                        {/if}
                    </button>
                </div>
            </form>
        </div>
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
</style>