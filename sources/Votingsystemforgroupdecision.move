module MyModule::VotingSystem {
    use aptos_framework::signer;
    use std::vector;
    
    /// Error codes
    const E_VOTING_ALREADY_EXISTS: u64 = 1;
    const E_VOTING_NOT_EXISTS: u64 = 2;
    const E_ALREADY_VOTED: u64 = 3;
    const E_INVALID_OPTION: u64 = 4;
    
    /// Struct representing a voting poll
    struct VotingPoll has store, key {
        proposal: vector<u8>,     // The proposal/question being voted on
        yes_votes: u64,           // Count of yes votes
        no_votes: u64,            // Count of no votes
        total_voters: u64,        // Total number of people who voted
        voters: vector<address>,  // List of addresses who have voted
    }
    
    /// Struct to track individual voter status
    struct VoterRecord has store, key {
        has_voted: bool,          // Whether the voter has already voted
        vote_choice: bool,        // true for yes, false for no
    }
    
    /// Function to create a new voting poll
    public fun create_voting_poll(creator: &signer, proposal: vector<u8>) {
        let creator_addr = signer::address_of(creator);
        
        // Ensure voting poll doesn't already exist
        assert!(!exists<VotingPoll>(creator_addr), E_VOTING_ALREADY_EXISTS);
        
        let poll = VotingPoll {
            proposal,
            yes_votes: 0,
            no_votes: 0,
            total_voters: 0,
            voters: vector::empty<address>(),
        };
        
        move_to(creator, poll);
    }
    
    /// Function to cast a vote (true for yes, false for no)
    public fun cast_vote(voter: &signer, poll_owner: address, vote: bool) acquires VotingPoll, VoterRecord {
        let voter_addr = signer::address_of(voter);
        
        // Ensure voting poll exists
        assert!(exists<VotingPoll>(poll_owner), E_VOTING_NOT_EXISTS);
        
        // Check if voter has already voted
        if (exists<VoterRecord>(voter_addr)) {
            let voter_record = borrow_global<VoterRecord>(voter_addr);
            assert!(!voter_record.has_voted, E_ALREADY_VOTED);
        };
        
        // Get the voting poll
        let poll = borrow_global_mut<VotingPoll>(poll_owner);
        
        // Update vote counts
        if (vote) {
            poll.yes_votes = poll.yes_votes + 1;
        } else {
            poll.no_votes = poll.no_votes + 1;
        };
        
        // Update total voters and add to voters list
        poll.total_voters = poll.total_voters + 1;
        vector::push_back(&mut poll.voters, voter_addr);
        
        // Create or update voter record
        if (exists<VoterRecord>(voter_addr)) {
            let voter_record = borrow_global_mut<VoterRecord>(voter_addr);
            voter_record.has_voted = true;
            voter_record.vote_choice = vote;
        } else {
            let voter_record = VoterRecord {
                has_voted: true,
                vote_choice: vote,
            };
            move_to(voter, voter_record);
        };
    }
}