// SPDX-License-Identifier: GPL-3.0
/*
    Copyright 2021 0KIMS association.

    This file is generated with [snarkJS](https://github.com/iden3/snarkjs).

    snarkJS is a free software: you can redistribute it and/or modify it
    under the terms of the GNU General Public License as published by
    the Free Software Foundation, either version 3 of the License, or
    (at your option) any later version.

    snarkJS is distributed in the hope that it will be useful, but WITHOUT
    ANY WARRANTY; without even the implied warranty of MERCHANTABILITY
    or FITNESS FOR A PARTICULAR PURPOSE. See the GNU General Public
    License for more details.

    You should have received a copy of the GNU General Public License
    along with snarkJS. If not, see <https://www.gnu.org/licenses/>.
*/

pragma solidity >=0.7.0 <0.9.0;

contract TallyVerifier {
    // Scalar field size
    uint256 constant r    = 21888242871839275222246405745257275088548364400416034343698204186575808495617;
    // Base field size
    uint256 constant q   = 21888242871839275222246405745257275088696311157297823662689037894645226208583;

    // Verification Key data
    uint256 constant alphax  = 20491192805390485299153009773594534940189261866228447918068658471970481763042;
    uint256 constant alphay  = 9383485363053290200918347156157836566562967994039712273449902621266178545958;
    uint256 constant betax1  = 4252822878758300859123897981450591353533073413197771768651442665752259397132;
    uint256 constant betax2  = 6375614351688725206403948262868962793625744043794305715222011528459656738731;
    uint256 constant betay1  = 21847035105528745403288232691147584728191162732299865338377159692350059136679;
    uint256 constant betay2  = 10505242626370262277552901082094356697409835680220590971873171140371331206856;
    uint256 constant gammax1 = 11559732032986387107991004021392285783925812861821192530917403151452391805634;
    uint256 constant gammax2 = 10857046999023057135944570762232829481370756359578518086990519993285655852781;
    uint256 constant gammay1 = 4082367875863433681332203403145435568316851327593401208105741076214120093531;
    uint256 constant gammay2 = 8495653923123431417604973247489272438418190587263600148770280649306958101930;
    uint256 constant deltax1 = 873322226988713515298461948624630229177271814454507249836838681845497302052;
    uint256 constant deltax2 = 6773305216130685216896053753876394332210341039720049992036936399074520472801;
    uint256 constant deltay1 = 15865070679434799369121808546755546970097393319948997351698270398710221971677;
    uint256 constant deltay2 = 12724684572553430722528176734575475660453260832850325172204084358748512789167;

    
    uint256 constant IC0x = 17811444883565731722238635114020755501213692994337831573781200677830488154262;
    uint256 constant IC0y = 4712463741466005311171215759390239897631799655134675346171093731530698261491;
    
    uint256 constant IC1x = 18927088586723780470917461662079433379224476148027423447683404847541185384186;
    uint256 constant IC1y = 16579747501360969818809885714216071338469432912915692845098019336036123665386;
    
    uint256 constant IC2x = 16095800986681541259046528866201121279144455737766628700239757374369529148415;
    uint256 constant IC2y = 9939181517398965022793234462809348515568568367539174176476798791808007971129;
    
    uint256 constant IC3x = 2911199244138791385477446061523493039685495385446300372490657662666137012092;
    uint256 constant IC3y = 3411504075206943486872252596145312482450454066866292730702052521446691725334;
    
    uint256 constant IC4x = 4340949297501206861652760001302867008182623066518198421124653362651094648051;
    uint256 constant IC4y = 19152083196535096127345174965448336091669976483021046113952167637480494911875;
    
    uint256 constant IC5x = 13952747600177400204840560282735311748648033783550402674383338187257173305915;
    uint256 constant IC5y = 16769475819003698286555739805393593768174803366562559043395662351509417346281;
    
    uint256 constant IC6x = 18217588422445332457443482207267440799878572245627644699267344332858093099199;
    uint256 constant IC6y = 21394654730230417522141033335254521931387821317615013422825157027935549609196;
    
    uint256 constant IC7x = 20154120341451196807625573623170626356181130655586344029265573565162412812780;
    uint256 constant IC7y = 9207603072679239459353164177731949807210290199334289666816100852933810252951;
    
    uint256 constant IC8x = 3375389972860574804413847260981185982257913756642277509458710950550189981897;
    uint256 constant IC8y = 18620279916621884715193832535837364464125032463120281701945757114310592943801;
    
    uint256 constant IC9x = 7822238611261368968837947478287172418795963948717950321173328162403194504005;
    uint256 constant IC9y = 3489097305748428617005987547479227164412151663378675505909841847235824399702;
    
    uint256 constant IC10x = 2767773489174985504391832635062580703286554317762524292413542331501170432899;
    uint256 constant IC10y = 1601742646778603439468276390598325332672047102228150746859539635675953509119;
    
    uint256 constant IC11x = 4465887422209610111683106919897072179807572829326261967877963392055432582442;
    uint256 constant IC11y = 8669426337232215167420532728551551975190010495173744850616795078389877651919;
    
    uint256 constant IC12x = 18502894824972931925595526157443353015999118242487213036210007150570509112870;
    uint256 constant IC12y = 21335961029415153607891504335573697959286904141086208140017670937607144628780;
    
    uint256 constant IC13x = 2024831607297248637756336963962080790412376299780191942694500290368020505298;
    uint256 constant IC13y = 19720211601513812864171105766093010901540252141348195222087193922070780793800;
    
    uint256 constant IC14x = 2028928204798728067008179584471187671315797455760896857415457524899341453029;
    uint256 constant IC14y = 21376706255808727495992894408431471245078863947605827265605526766359006693804;
    
    uint256 constant IC15x = 13820439793504602386549904614345212053620347778274858582800085316143515210010;
    uint256 constant IC15y = 3510489364507576568648218357901925595568194475959155182875593345414761477139;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[15] calldata _pubSignals) public view returns (bool) {
        assembly {
            function checkField(v) {
                if iszero(lt(v, r)) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }
            
            // G1 function to multiply a G1 value(x,y) to value in an address
            function g1_mulAccC(pR, x, y, s) {
                let success
                let mIn := mload(0x40)
                mstore(mIn, x)
                mstore(add(mIn, 32), y)
                mstore(add(mIn, 64), s)

                success := staticcall(sub(gas(), 2000), 7, mIn, 96, mIn, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }

                mstore(add(mIn, 64), mload(pR))
                mstore(add(mIn, 96), mload(add(pR, 32)))

                success := staticcall(sub(gas(), 2000), 6, mIn, 128, pR, 64)

                if iszero(success) {
                    mstore(0, 0)
                    return(0, 0x20)
                }
            }

            function checkPairing(pA, pB, pC, pubSignals, pMem) -> isOk {
                let _pPairing := add(pMem, pPairing)
                let _pVk := add(pMem, pVk)

                mstore(_pVk, IC0x)
                mstore(add(_pVk, 32), IC0y)

                // Compute the linear combination vk_x
                
                g1_mulAccC(_pVk, IC1x, IC1y, calldataload(add(pubSignals, 0)))
                
                g1_mulAccC(_pVk, IC2x, IC2y, calldataload(add(pubSignals, 32)))
                
                g1_mulAccC(_pVk, IC3x, IC3y, calldataload(add(pubSignals, 64)))
                
                g1_mulAccC(_pVk, IC4x, IC4y, calldataload(add(pubSignals, 96)))
                
                g1_mulAccC(_pVk, IC5x, IC5y, calldataload(add(pubSignals, 128)))
                
                g1_mulAccC(_pVk, IC6x, IC6y, calldataload(add(pubSignals, 160)))
                
                g1_mulAccC(_pVk, IC7x, IC7y, calldataload(add(pubSignals, 192)))
                
                g1_mulAccC(_pVk, IC8x, IC8y, calldataload(add(pubSignals, 224)))
                
                g1_mulAccC(_pVk, IC9x, IC9y, calldataload(add(pubSignals, 256)))
                
                g1_mulAccC(_pVk, IC10x, IC10y, calldataload(add(pubSignals, 288)))
                
                g1_mulAccC(_pVk, IC11x, IC11y, calldataload(add(pubSignals, 320)))
                
                g1_mulAccC(_pVk, IC12x, IC12y, calldataload(add(pubSignals, 352)))
                
                g1_mulAccC(_pVk, IC13x, IC13y, calldataload(add(pubSignals, 384)))
                
                g1_mulAccC(_pVk, IC14x, IC14y, calldataload(add(pubSignals, 416)))
                
                g1_mulAccC(_pVk, IC15x, IC15y, calldataload(add(pubSignals, 448)))
                

                // -A
                mstore(_pPairing, calldataload(pA))
                mstore(add(_pPairing, 32), mod(sub(q, calldataload(add(pA, 32))), q))

                // B
                mstore(add(_pPairing, 64), calldataload(pB))
                mstore(add(_pPairing, 96), calldataload(add(pB, 32)))
                mstore(add(_pPairing, 128), calldataload(add(pB, 64)))
                mstore(add(_pPairing, 160), calldataload(add(pB, 96)))

                // alpha1
                mstore(add(_pPairing, 192), alphax)
                mstore(add(_pPairing, 224), alphay)

                // beta2
                mstore(add(_pPairing, 256), betax1)
                mstore(add(_pPairing, 288), betax2)
                mstore(add(_pPairing, 320), betay1)
                mstore(add(_pPairing, 352), betay2)

                // vk_x
                mstore(add(_pPairing, 384), mload(add(pMem, pVk)))
                mstore(add(_pPairing, 416), mload(add(pMem, add(pVk, 32))))


                // gamma2
                mstore(add(_pPairing, 448), gammax1)
                mstore(add(_pPairing, 480), gammax2)
                mstore(add(_pPairing, 512), gammay1)
                mstore(add(_pPairing, 544), gammay2)

                // C
                mstore(add(_pPairing, 576), calldataload(pC))
                mstore(add(_pPairing, 608), calldataload(add(pC, 32)))

                // delta2
                mstore(add(_pPairing, 640), deltax1)
                mstore(add(_pPairing, 672), deltax2)
                mstore(add(_pPairing, 704), deltay1)
                mstore(add(_pPairing, 736), deltay2)


                let success := staticcall(sub(gas(), 2000), 8, _pPairing, 768, _pPairing, 0x20)

                isOk := and(success, mload(_pPairing))
            }

            let pMem := mload(0x40)
            mstore(0x40, add(pMem, pLastMem))

            // Validate that all evaluations ∈ F
            
            checkField(calldataload(add(_pubSignals, 0)))
            
            checkField(calldataload(add(_pubSignals, 32)))
            
            checkField(calldataload(add(_pubSignals, 64)))
            
            checkField(calldataload(add(_pubSignals, 96)))
            
            checkField(calldataload(add(_pubSignals, 128)))
            
            checkField(calldataload(add(_pubSignals, 160)))
            
            checkField(calldataload(add(_pubSignals, 192)))
            
            checkField(calldataload(add(_pubSignals, 224)))
            
            checkField(calldataload(add(_pubSignals, 256)))
            
            checkField(calldataload(add(_pubSignals, 288)))
            
            checkField(calldataload(add(_pubSignals, 320)))
            
            checkField(calldataload(add(_pubSignals, 352)))
            
            checkField(calldataload(add(_pubSignals, 384)))
            
            checkField(calldataload(add(_pubSignals, 416)))
            
            checkField(calldataload(add(_pubSignals, 448)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
