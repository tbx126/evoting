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
    uint256 constant deltax1 = 4246465159345868461042304841135001988643999885847643592609817782720556931144;
    uint256 constant deltax2 = 5932623381331995345717617312061652604441726827556020830851921911502530896306;
    uint256 constant deltay1 = 2541852492823612854390759078649984486801472663473445693092473353521710963479;
    uint256 constant deltay2 = 2084985391203007416419194423075276027574945029460797754717364916047549181904;

    
    uint256 constant IC0x = 16279692547788338955022182834873530737755149109034289871782667132395804070233;
    uint256 constant IC0y = 17152572970275162565510376874713176611942227313644846570653674343701910812990;
    
    uint256 constant IC1x = 14258101814918345109565164727206036665818456191523256907733842084236051917563;
    uint256 constant IC1y = 21082380839331253727720932661142032897945538232372457267349253881895177863038;
    
    uint256 constant IC2x = 13873260664061002306569866438481358479708039456909497189594882932334172064619;
    uint256 constant IC2y = 20399429132004244295255853370949586711806820735408176664196811662627843115664;
    
    uint256 constant IC3x = 21297394430653274563093763794760342711919590533487258249357778753118738121059;
    uint256 constant IC3y = 19436699262443859562429691662815981754993276375234313990936026339256316631501;
    
    uint256 constant IC4x = 5609191978709511300769869804863106076095379458678181594485008594897296613571;
    uint256 constant IC4y = 10064277028690806820879263670603691850651996680578319413264218325101803691767;
    
    uint256 constant IC5x = 6403189456089228234748857543000670514918433923065346633817640807483577765813;
    uint256 constant IC5y = 10840505822078116513770049814251287308457529809193935701878137330734309393223;
    
    uint256 constant IC6x = 12184121658186827474256704276596285067047797049090235427832042533553183766177;
    uint256 constant IC6y = 17732429434995429531769052288414871452222213620901692545613784059548286330420;
    
    uint256 constant IC7x = 6970450842669262585203570780191986273440739845430051476230656215027109859823;
    uint256 constant IC7y = 10999378676388878704834296041349786210049218118597907995265901112547041964600;
    
    uint256 constant IC8x = 20397405427056049587802359714395346304628935676858620911920090674916416904414;
    uint256 constant IC8y = 14814277077746645596300327041853379948345772456816864914550368978046109693008;
    
    uint256 constant IC9x = 3362285388975608770585037782987486473700010694049594108657849109335146109940;
    uint256 constant IC9y = 3764096355662562222328452522939363668494202769555043191915611606000960857491;
    
    uint256 constant IC10x = 1600326754864153797587507300538661841345617671200264443061232482540235956682;
    uint256 constant IC10y = 3273879358120267124205665758522079273581915218028514312300522577766413483331;
    
    uint256 constant IC11x = 20832299655074129779142128406561891086731478139276828295740523911165201324393;
    uint256 constant IC11y = 3902537430240837026685448367702306456257374426613340788581630754483265268025;
    
    uint256 constant IC12x = 4155021098224448279079999697824778901296992999648829577742017146312166824472;
    uint256 constant IC12y = 6162077834877753935945001307624615149338231361870330010913359330946282652474;
    
    uint256 constant IC13x = 17695317966830269679337311754387708211303640344538962613503895775842489269012;
    uint256 constant IC13y = 9395317610788840319686045607456625442551287486415706698191330826542743119785;
    
    uint256 constant IC14x = 19675490969830175093282941173969861327407055688722872587796235453601095234601;
    uint256 constant IC14y = 14888320008963176592751442167218271541298012822374945576547051536740192645319;
    
    uint256 constant IC15x = 14603769225974413142621862944872065431962909857052551371592428719174683818046;
    uint256 constant IC15y = 5073449738483811677029387499046799811358857422935930813705180659773368320253;
    
    uint256 constant IC16x = 2661888360141180567510555250703601239813050904675251387852351150587678977344;
    uint256 constant IC16y = 11301208734603058881646592892499238794233940119030396810112849227083350356378;
    
    uint256 constant IC17x = 18667607333947791510383913782402690276691151516912540768498890037250181117016;
    uint256 constant IC17y = 21078833686590926073374129541164270842606410671072275403238817233051695604380;
    
    uint256 constant IC18x = 5149737480148889023543441907768833142145938951105788047584993342988584234104;
    uint256 constant IC18y = 10287287569921821690448047456213010563221584049795787758836546016353281876931;
    
    uint256 constant IC19x = 16261850689627137510798162822812408490396862429091853784921677349655243832269;
    uint256 constant IC19y = 20645950153485732436811843316475274215402248132752139421791286729514539908321;
    
    uint256 constant IC20x = 8139857048204285651243002362999913242237696572215425216365652103860495083152;
    uint256 constant IC20y = 1801201874552436338372403490404086829984386662804093375715040137047320424005;
    
    uint256 constant IC21x = 19000964201820003191820845534359959106180937551445932153633289116783039066843;
    uint256 constant IC21y = 8969806501608016858452981121209923180662206393771114903301820260701717479106;
    
 
    // Memory data
    uint16 constant pVk = 0;
    uint16 constant pPairing = 128;

    uint16 constant pLastMem = 896;

    function verifyProof(uint[2] calldata _pA, uint[2][2] calldata _pB, uint[2] calldata _pC, uint[21] calldata _pubSignals) public view returns (bool) {
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
                
                g1_mulAccC(_pVk, IC16x, IC16y, calldataload(add(pubSignals, 480)))
                
                g1_mulAccC(_pVk, IC17x, IC17y, calldataload(add(pubSignals, 512)))
                
                g1_mulAccC(_pVk, IC18x, IC18y, calldataload(add(pubSignals, 544)))
                
                g1_mulAccC(_pVk, IC19x, IC19y, calldataload(add(pubSignals, 576)))
                
                g1_mulAccC(_pVk, IC20x, IC20y, calldataload(add(pubSignals, 608)))
                
                g1_mulAccC(_pVk, IC21x, IC21y, calldataload(add(pubSignals, 640)))
                

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
            
            checkField(calldataload(add(_pubSignals, 480)))
            
            checkField(calldataload(add(_pubSignals, 512)))
            
            checkField(calldataload(add(_pubSignals, 544)))
            
            checkField(calldataload(add(_pubSignals, 576)))
            
            checkField(calldataload(add(_pubSignals, 608)))
            
            checkField(calldataload(add(_pubSignals, 640)))
            

            // Validate all evaluations
            let isValid := checkPairing(_pA, _pB, _pC, _pubSignals, pMem)

            mstore(0, isValid)
             return(0, 0x20)
         }
     }
 }
